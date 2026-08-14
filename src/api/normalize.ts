import { CodecksCard, CodecksDeck, CodecksProject } from "../types";

/**
 * Codecks responses are normalised: a relation returns only an id, and the entity
 * sits under its own type key. card.assignee is a user id, named in user[id].name.
 *
 * Two traps the probe exposed, both handled here:
 *  - a card is keyed by cardId, not id, while decks, projects and users use id
 *  - ask for projectId and project_id comes back (unlike accountId and cardId,
 *    which stay camelCase). Both spellings are read.
 */

type Bag = Record<string, unknown>;

function table(res: unknown, name: string): Bag[] {
  if (!res || typeof res !== "object") return [];
  const section = (res as Bag)[name];
  if (!section || typeof section !== "object") return [];
  return Object.values(section as Record<string, Bag>).filter(
    (v): v is Bag => !!v && typeof v === "object"
  );
}

/** First key that actually holds a value — for fields whose naming is inconsistent */
function pick(row: Bag, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function num(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseProjects(res: unknown): CodecksProject[] {
  return table(res, "project").map((row) => ({
    id: str(pick(row, "id")),
    name: str(pick(row, "name")),
    deckIds: [],
  }));
}

export function parseDecks(res: unknown): CodecksDeck[] {
  return table(res, "deck").map((row) => ({
    id: str(pick(row, "id")),
    title: str(pick(row, "title")),
    projectId: str(pick(row, "project_id", "projectId")),
    spaceId: num(pick(row, "spaceId", "space_id")),
  }));
}

export interface ParseCardsContext {
  decks: CodecksDeck[];
  projects: CodecksProject[];
}

export function parseCards(res: unknown, ctx: ParseCardsContext): CodecksCard[] {
  const deckById = new Map(ctx.decks.map((d) => [d.id, d]));
  const projectById = new Map(ctx.projects.map((p) => [p.id, p]));
  // Users arrive in this same response, because assignee was asked for as a relation
  const userById = new Map(
    table(res, "user").map((u) => [str(pick(u, "id")), str(pick(u, "name"))])
  );

  return table(res, "card").map((row) => {
    const deckId = str(pick(row, "deckId", "deck_id", "deck"));
    const deck = deckById.get(deckId);
    const project = deck ? projectById.get(deck.projectId) : undefined;
    const assigneeId = str(pick(row, "assignee", "assigneeId"));

    return {
      id: str(pick(row, "cardId", "id")),
      accountSeq: num(pick(row, "accountSeq")),
      title: str(pick(row, "title")),
      content: str(pick(row, "content")),
      status: str(pick(row, "status")),
      effort: num(pick(row, "effort")),
      priority: str(pick(row, "priority")),
      dueDate: str(pick(row, "dueDate")),
      isDoc: pick(row, "isDoc") === true,
      visibility: str(pick(row, "visibility")) || "default",
      deckId,
      deckName: deck?.title ?? "",
      spaceId: deck?.spaceId ?? null,
      projectId: deck?.projectId ?? "",
      projectName: project?.name ?? "",
      assigneeName: userById.get(assigneeId) ?? "",
      createdAt: str(pick(row, "createdAt")),
    };
  });
}

/** Card id → body text, from a bodies-only response */
export function parseCardBodies(res: unknown): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of table(res, "card")) {
    const id = str(pick(row, "cardId", "id"));
    if (id) out.set(id, str(pick(row, "content")));
  }
  return out;
}

/**
 * Card titles are sometimes empty, with the real text in content whose first line
 * is the title. An unnamed task needs better than an empty string.
 *
 * content is no longer part of the initial load, so this falls back to the card
 * number rather than reaching for text that is not there yet.
 */
export function displayTitle(card: CodecksCard): string {
  const fromTitle = card.title.trim();
  if (fromTitle) return fromTitle;
  const firstLine = (card.content ?? "").split(/\r?\n/).find((l) => l.trim());
  return (firstLine ?? "").trim() || `Card ${card.accountSeq ?? ""}`.trim();
}
