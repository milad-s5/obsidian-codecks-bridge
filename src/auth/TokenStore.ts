import { App } from "obsidian";

/**
 * The Codecks token lives in its own file next to the plugin, never in data.json.
 *
 * data.json is committed and pushed in this vault (every other plugin's is), so a token
 * placed there would end up on GitHub. This file is gitignored instead.
 *
 * Everything here goes through vault.adapter — no Node, no Electron — so it behaves the
 * same on Windows, Linux, Android and iOS. There is no OS keychain available to a plugin
 * on mobile, so this is as far as storage can go; the protection that actually matters is
 * using a read-only *observer* token, not this file.
 */
const SECRET_FILE = "secret.json";

export class TokenStore {
  private cached: string | null = null;
  private loaded = false;

  constructor(private app: App, private pluginDir: string) {}

  private get path(): string {
    return `${this.pluginDir}/${SECRET_FILE}`;
  }

  async read(): Promise<string | null> {
    if (this.loaded) return this.cached;
    this.loaded = true;
    try {
      if (!(await this.app.vault.adapter.exists(this.path))) {
        this.cached = null;
        return null;
      }
      const raw = await this.app.vault.adapter.read(this.path);
      const parsed = JSON.parse(raw) as { token?: unknown };
      this.cached = typeof parsed.token === "string" && parsed.token ? parsed.token : null;
    } catch {
      // پیکربندی خراب نباید پلاگین رو از کار بندازه — انگار توکنی نیست
      this.cached = null;
    }
    return this.cached;
  }

  async write(token: string): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error("Empty token");
    await this.app.vault.adapter.write(
      this.path,
      JSON.stringify({ token: trimmed }, null, 2)
    );
    this.cached = trimmed;
    this.loaded = true;
  }

  async clear(): Promise<void> {
    try {
      if (await this.app.vault.adapter.exists(this.path)) {
        await this.app.vault.adapter.remove(this.path);
      }
    } finally {
      this.cached = null;
      this.loaded = true;
    }
  }

  async has(): Promise<boolean> {
    return (await this.read()) !== null;
  }

  /** فقط برای نمایش در تنظیمات — خودِ توکن هیچ‌وقت به UI برنمی‌گرده */
  async describe(): Promise<string> {
    const t = await this.read();
    if (!t) return "not set";
    return `saved (${t.length} characters)`;
  }
}
