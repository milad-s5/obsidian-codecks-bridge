import { CodecksCard, CodecksDeck, CodecksProject } from "../types";

/**
 * پاسخِ Codecks نرمال‌شده‌ست: هر رابطه فقط یک id برمی‌گردونه و خودِ موجودیت زیر
 * کلیدِ نوعش می‌شینه. مثلاً card.assignee یک id کاربره و اسمش توی user[id].name.
 *
 * دو تله‌ای که probe لو داد و اینجا لحاظ شدن:
 *  - کلیدِ کارت cardId است نه id، ولی دک و پروژه و کاربر id دارن
 *  - projectId رو می‌خوای، project_id تحویل می‌گیری (برخلاف accountId و cardId
 *    که camelCase برمی‌گردن). هر دو شکل خونده می‌شه.
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

/** اولین کلیدی که واقعاً مقدار داره — برای فیلدهایی که اسمشون یکدست نیست */
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
  }));
}

export interface ParseCardsContext {
  decks: CodecksDeck[];
  projects: CodecksProject[];
}

export function parseCards(res: unknown, ctx: ParseCardsContext): CodecksCard[] {
  const deckById = new Map(ctx.decks.map((d) => [d.id, d]));
  const projectById = new Map(ctx.projects.map((p) => [p.id, p]));
  // کاربرها توی همین پاسخ میان، چون assignee به‌شکل رابطه خواسته شده
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
      deckId,
      deckName: deck?.title ?? "",
      projectId: deck?.projectId ?? "",
      projectName: project?.name ?? "",
      assigneeName: userById.get(assigneeId) ?? "",
      createdAt: str(pick(row, "createdAt")),
    };
  });
}

/**
 * عنوانِ کارت‌ها گاهی خالیه و متنِ واقعی توی content است (خط اول = عنوان).
 * برای تسکِ بی‌نام، چیزی بهتر از رشته‌ی خالی لازم داریم.
 */
export function displayTitle(card: CodecksCard): string {
  const fromTitle = card.title.trim();
  if (fromTitle) return fromTitle;
  const firstLine = card.content.split(/\r?\n/).find((l) => l.trim());
  return (firstLine ?? "").trim() || `Card ${card.accountSeq ?? ""}`.trim();
}
