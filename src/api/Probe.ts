import { App, normalizePath } from "obsidian";
import { CodecksClient, CodecksError } from "./CodecksClient";

/**
 * فاز کشف.
 *
 * دورِ اول: کارت‌ها ۵۰۰ می‌دادن. دورِ دوم با اضافه‌کردنِ فیلدها یکی‌یکی معلوم شد
 * مقصر assigneeId است، و اینکه آرگومان‌های $limit/فیلتر روی account.cards هم رد
 * می‌شن. این دور دنبالِ سه چیز باقی‌مانده‌ست: راهِ درستِ گرفتنِ assignee، راهی
 * برای محدودکردن نتایج، و اینکه کارتِ «داکیومنت» از تسک جدا می‌شه یا نه.
 *
 * خروجی دیگه JSONِ خام نیست — قبلاً حجمِ آرایه‌ی idها باعث می‌شد خودِ موجودیت‌ها
 * قیچی بشن. حالا برای هر نوع، تعداد و یک نمونه چاپ می‌شه.
 */
interface ProbeStep {
  label: string;
  query: unknown;
}

const STEPS: ProbeStep[] = [
  {
    label: "all working card fields together",
    query: {
      _root: [
        {
          account: [
            {
              cards: [
                "title",
                "status",
                "content",
                "effort",
                "priority",
                "accountSeq",
                "createdAt",
                "dueDate",
                "deckId",
              ],
            },
          ],
        },
      ],
    },
  },
  {
    label: "card.isDoc (are doc cards separable from tasks?)",
    query: { _root: [{ account: [{ cards: ["title", "isDoc"] }] }] },
  },
  {
    label: "card.visibility",
    query: { _root: [{ account: [{ cards: ["title", "visibility"] }] }] },
  },
  {
    label: "assignee as a nested relation",
    query: { _root: [{ account: [{ cards: ["title", { assignee: ["name"] }] }] }] },
  },
  {
    label: "assignee as a plain field",
    query: { _root: [{ account: [{ cards: ["title", "assignee"] }] }] },
  },
  {
    label: "deck as a nested relation on card",
    query: { _root: [{ account: [{ cards: ["title", { deck: ["title", "projectId"] }] }] }] },
  },
  {
    label: "milestone as a nested relation",
    query: { _root: [{ account: [{ cards: ["title", { milestone: ["name"] }] }] }] },
  },
  {
    label: 'order only — cards({"$order":"createdAt"})',
    query: { _root: [{ account: [{ 'cards({"$order":"createdAt"})': ["title"] }] }] },
  },
  {
    label: 'filter only — cards({"status":"done"})',
    query: { _root: [{ account: [{ 'cards({"status":"done"})': ["title", "status"] }] }] },
  },
  {
    label: 'limit on the deck relation — decks{ cards({"$limit":3}) }',
    query: {
      _root: [{ account: [{ decks: ["title", { 'cards({"$limit":3})': ["title", "status"] }] }] }],
    },
  },
  {
    label: "cards via decks with full fields",
    query: {
      _root: [
        {
          account: [
            { decks: ["title", "projectId", { cards: ["title", "status", "effort", "accountSeq"] }] },
          ],
        },
      ],
    },
  },
];

export interface ProbeResult {
  notePath: string;
  statuses: string[];
  ok: number;
  failed: number;
}

export class Probe {
  constructor(private app: App, private client: CodecksClient) {}

  async run(): Promise<ProbeResult> {
    const body: string[] = [];
    const summary: string[] = [];
    const statuses = new Set<string>();
    let ok = 0;
    let failed = 0;

    for (const step of STEPS) {
      try {
        const res = await this.client.query(step.query);
        for (const s of collectStatuses(res)) statuses.add(s);
        ok++;
        summary.push(`- ✅ ${step.label}`);
        body.push(
          `## ✅ ${step.label}`,
          "",
          "```json",
          JSON.stringify(step.query),
          "```",
          "",
          ...describe(res),
          ""
        );
      } catch (err) {
        failed++;
        const msg = err instanceof CodecksError ? `${err.kind}: ${err.message}` : String(err);
        summary.push(`- ❌ ${step.label} — ${msg}`);
        body.push(`## ❌ ${step.label}`, "", "```json", JSON.stringify(step.query), "```", "", "```", msg, "```", "");

        if (
          err instanceof CodecksError &&
          (err.kind === "auth" || err.kind === "no-token" || err.kind === "no-subdomain")
        ) {
          body.push("_Stopped early: every remaining step would fail the same way._", "");
          break;
        }
      }
    }

    const note = [
      "# Codecks API probe",
      "",
      `Run at ${new Date().toISOString()}.`,
      "",
      "## Summary",
      "",
      ...summary,
      "",
      statuses.size
        ? `**Card statuses seen:** ${[...statuses].sort().map((s) => `\`${s}\``).join(", ")}`
        : "**No card statuses seen.**",
      "",
      "---",
      "",
      ...body,
    ].join("\n");

    const notePath = normalizePath("Codecks API probe.md");
    await this.app.vault.adapter.write(notePath, note);

    return { notePath, statuses: [...statuses].sort(), ok, failed };
  }
}

/**
 * به‌جای چاپِ کلِ پاسخ، برای هر نوع موجودیت تعداد و یک نمونه رو نشون می‌ده.
 * آرایه‌ی idها می‌تونه صدها عضو داشته باشه و خودِ موجودیت‌ها رو از دیدرس ببره.
 */
function describe(res: unknown): string[] {
  if (res === null || typeof res !== "object") return ["```", String(res), "```"];

  const out: string[] = [];
  for (const [type, value] of Object.entries(res as Record<string, unknown>)) {
    if (type === "_root") {
      out.push(`\`_root\`: \`${JSON.stringify(value)}\``, "");
      continue;
    }
    if (value === null || typeof value !== "object") continue;

    const entries = Object.entries(value as Record<string, unknown>);
    out.push(`**${type}** — ${entries.length} item(s)`, "");
    const [, sample] = entries[0] ?? [];
    if (sample !== undefined) {
      out.push("First one:", "", "```json", trim(JSON.stringify(sample, null, 2), 1200), "```", "");
    }
    if (entries.length > 1) {
      const [, second] = entries[1];
      out.push("Second one:", "", "```json", trim(JSON.stringify(second, null, 2), 1200), "```", "");
    }
  }
  return out;
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n… ${text.length - max} more characters`;
}

function collectStatuses(node: unknown, depth = 0): string[] {
  if (depth > 8 || node === null || typeof node !== "object") return [];
  const out: string[] = [];
  if (Array.isArray(node)) {
    for (const item of node) out.push(...collectStatuses(item, depth + 1));
    return out;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "status" && typeof value === "string" && value) out.push(value);
    else out.push(...collectStatuses(value, depth + 1));
  }
  return out;
}
