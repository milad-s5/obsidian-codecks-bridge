import { CodecksCard, CodecksBridgeSettings } from "../types";
import { displayTitle } from "../api/normalize";
import { cardUrl } from "../api/queries";

/** همون سطحی که Project Manager بیرون می‌ده — اینجا فقط چیزی که لازمه */
export interface PmApi {
  version: number;
  listWorkspaces(): { id: string; name: string }[];
  ensureProject(
    workspaceId: string,
    input: { title: string; status?: string; priority?: string; due?: string }
  ): Promise<{ slug: string; path: string }>;
  createTask(
    workspaceId: string,
    input: {
      title: string;
      projectSlug: string;
      status?: string;
      priority?: string;
      due?: string;
      extra?: Record<string, string | number>;
    }
  ): Promise<{ slug: string; path: string }>;
  findTaskBy(workspaceId: string, key: string, value: string): { slug: string; path: string } | null;
}

/** کلیدی که با اون تشخیص می‌دیم این کارت قبلاً وارد شده */
export const CODECKS_ID_KEY = "codecks_id";

export interface ImportOutcome {
  card: CodecksCard;
  result: "imported" | "skipped" | "failed";
  reason?: string;
  path?: string;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  failed: number;
  outcomes: ImportOutcome[];
}

export function mapStatus(settings: CodecksBridgeSettings, codecksStatus: string): string {
  const key = (codecksStatus ?? "").trim().toLowerCase();
  return settings.statusMap[key] ?? settings.defaultStatus;
}

export class Importer {
  constructor(private api: PmApi, private settings: CodecksBridgeSettings) {}

  /** آیا این کارت از قبل به‌شکل تسک وجود داره؟ */
  alreadyImported(workspaceId: string, card: CodecksCard): boolean {
    try {
      return this.api.findTaskBy(workspaceId, CODECKS_ID_KEY, card.id) !== null;
    } catch {
      return false;
    }
  }

  /**
   * کارت‌های انتخاب‌شده رو وارد می‌کنه.
   *
   * شکستِ یک کارت نباید بقیه رو زمین بزنه — دسته‌ای که وسطش رها بشه بدترین حالته،
   * چون معلوم نیست چی رفته چی نرفته. هر کارت جدا گزارش می‌شه.
   */
  async importCards(
    workspaceId: string,
    cards: CodecksCard[],
    onProgress?: (done: number, total: number) => void
  ): Promise<ImportSummary> {
    const outcomes: ImportOutcome[] = [];
    // پروژه‌هایی که توی همین اجرا ساخته/پیدا شدن، تا برای هر کارت دوباره نگردیم
    const projectSlugs = new Map<string, string>();

    let done = 0;
    for (const card of cards) {
      try {
        if (this.alreadyImported(workspaceId, card)) {
          outcomes.push({ card, result: "skipped", reason: "already imported" });
          continue;
        }

        // پروژه‌ی Project Manager از روی *دک* ساخته می‌شود، نه از روی پروژه‌ی
        // Codecks. در عمل دک همان واحد کاری است (Arbitrage)، و پروژه‌ی Codecks
        // یک سطح بالاتر و کلی‌تر است (peach) — ساختن پروژه‌ای به اسم peach همه‌ی
        // تسک‌ها را در یک سطل می‌ریخت.
        const projectName = card.deckName || card.projectName || "Codecks";
        let slug = projectSlugs.get(projectName);
        if (!slug) {
          const project = await this.api.ensureProject(workspaceId, {
            title: projectName,
            status: "active",
          });
          slug = project.slug;
          projectSlugs.set(projectName, slug);
        }

        const created = await this.api.createTask(workspaceId, {
          title: displayTitle(card),
          projectSlug: slug,
          status: mapStatus(this.settings, card.status),
          due: card.dueDate ? card.dueDate.slice(0, 10) : "",
          extra: this.frontmatterFor(card),
        });

        outcomes.push({ card, result: "imported", path: created.path });
      } catch (err) {
        outcomes.push({
          card,
          result: "failed",
          reason: err instanceof Error ? err.message : String(err),
        });
      } finally {
        done++;
        onProgress?.(done, cards.length);
      }
    }

    return {
      imported: outcomes.filter((o) => o.result === "imported").length,
      skipped: outcomes.filter((o) => o.result === "skipped").length,
      failed: outcomes.filter((o) => o.result === "failed").length,
      outcomes,
    };
  }

  private frontmatterFor(card: CodecksCard): Record<string, string | number> {
    const extra: Record<string, string | number> = { [CODECKS_ID_KEY]: card.id };
    if (card.accountSeq !== null) extra.codecks_seq = card.accountSeq;
    if (card.deckName) extra.codecks_deck = card.deckName;
    // پروژه‌ی Codecks خودش پروژه‌ی PM نمی‌شود، ولی دانستنش برای ردیابی می‌ارزد
    if (card.projectName) extra.codecks_project = card.projectName;
    if (card.effort !== null) extra.codecks_effort = card.effort;
    if (card.assigneeName) extra.codecks_assignee = card.assigneeName;
    const url = cardUrl(this.settings.subdomain, card.accountSeq);
    if (url) extra.codecks_url = url;
    return extra;
  }
}
