import { CodecksCard, CodecksBridgeSettings } from "../types";
import { displayTitle } from "../api/normalize";


/** The slice of Project Manager's API this needs */
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

/** Frontmatter key that tells us a card has already been imported */
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

  /** Does this card already exist as a task? */
  alreadyImported(workspaceId: string, card: CodecksCard): boolean {
    try {
      return this.api.findTaskBy(workspaceId, CODECKS_ID_KEY, card.id) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Imports the selected cards.
   *
   * One bad card must not take the rest down: a batch abandoned halfway is the
   * worst outcome, since nothing says what landed. Each card reports separately.
   */
  async importCards(
    workspaceId: string,
    cards: CodecksCard[],
    onProgress?: (done: number, total: number) => void
  ): Promise<ImportSummary> {
    const outcomes: ImportOutcome[] = [];
    // Projects created or found during this run, so we do not look them up per card
    const projectSlugs = new Map<string, string>();

    let done = 0;
    for (const card of cards) {
      try {
        if (this.alreadyImported(workspaceId, card)) {
          outcomes.push({ card, result: "skipped", reason: "already imported" });
          continue;
        }

        // The Project Manager project is named after the *deck*, not the Codecks
        // project. In practice the deck is the unit of work (Arbitrage), while the
        // Codecks project sits a level above it (peach) — naming the project peach
        // tipped every task into a single bucket.
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
    // The Codecks project does not become the PM project, but it is worth recording
    if (card.projectName) extra.codecks_project = card.projectName;
    if (card.effort !== null) extra.codecks_effort = card.effort;
    if (card.assigneeName) extra.codecks_assignee = card.assigneeName;
    // No codecks_url. The address built from accountSeq does not resolve and the
    // probe found no field to build a real one from, so this was writing a dead
    // link into every imported task. codecks_seq is enough to find the card.
    return extra;
  }
}
