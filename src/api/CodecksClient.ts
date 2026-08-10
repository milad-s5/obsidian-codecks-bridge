import { App, requestUrl } from "obsidian";
import { TokenStore } from "../auth/TokenStore";

const ENDPOINT = "https://api.codecks.io/";

/** خطاهای این کلاینت هیچ‌وقت توکن رو داخل پیامشون نمی‌ذارن */
export type CodecksErrorKind = "no-token" | "no-subdomain" | "auth" | "rate-limit" | "http" | "network";

export class CodecksError extends Error {
  constructor(readonly kind: CodecksErrorKind, message: string, readonly status?: number) {
    super(message);
    this.name = "CodecksError";
  }
}

/**
 * سقفِ اعلام‌شده ۴۰ درخواست در ۵ ثانیه به‌ازای هر IP است. با ۳۰ کار می‌کنیم تا
 * اگر چیز دیگه‌ای از همین IP با Codecks حرف می‌زنه، ما اونو از کار نندازیم.
 */
export class RateLimiter {
  private stamps: number[] = [];
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly max = 30,
    private readonly windowMs = 5000,
    private readonly sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
  ) {}

  /** صف‌بندی سریالی — وگرنه چند فراخوانِ هم‌زمان همگی از سقف رد می‌شن */
  take(): Promise<void> {
    const next = this.chain.then(() => this.reserve());
    this.chain = next.catch(() => undefined);
    return next;
  }

  private async reserve(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
      if (this.stamps.length < this.max) {
        this.stamps.push(now);
        return;
      }
      await this.sleep(this.windowMs - (now - this.stamps[0]) + 10);
    }
  }
}

export class CodecksClient {
  private limiter = new RateLimiter();

  constructor(
    private app: App,
    private tokens: TokenStore,
    private getSubdomain: () => string
  ) {}

  /**
   * یک کوئری خام می‌فرسته و بدنه‌ی پاسخ رو برمی‌گردونه.
   *
   * از requestUrl اوبسیدین استفاده می‌کنه نه fetch: یک fetch از رِندرر به دامنه‌ی
   * دیگه با CORS بلاک می‌شه.
   */
  async query(query: unknown): Promise<unknown> {
    const subdomain = this.getSubdomain().trim();
    if (!subdomain) {
      throw new CodecksError("no-subdomain", "Set your Codecks subdomain in the plugin settings.");
    }
    const token = await this.tokens.read();
    if (!token) {
      throw new CodecksError("no-token", "No Codecks token saved. Add one in the plugin settings.");
    }

    await this.limiter.take();

    let res;
    try {
      res = await requestUrl({
        url: ENDPOINT,
        method: "POST",
        headers: {
          "X-Account": subdomain,
          "X-Auth-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        throw: false,
      });
    } catch (err) {
      throw new CodecksError("network", "Could not reach api.codecks.io. Check your connection.");
    }

    if (res.status === 401 || res.status === 403) {
      throw new CodecksError("auth", "Codecks rejected the token. Replace it in the plugin settings.", res.status);
    }
    if (res.status === 429) {
      throw new CodecksError("rate-limit", "Codecks rate limit hit. Wait a few seconds and retry.", 429);
    }
    if (res.status >= 400) {
      throw new CodecksError("http", `Codecks returned HTTP ${res.status}.`, res.status);
    }

    try {
      return res.json;
    } catch {
      throw new CodecksError("http", "Codecks returned a response that was not JSON.", res.status);
    }
  }
}
