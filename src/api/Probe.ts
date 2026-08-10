import { App, normalizePath } from "obsidian";
import { CodecksClient, CodecksError } from "./CodecksClient";

/**
 * فاز کشف. مستندات Codecks نه مقادیر واقعیِ status رو می‌گه نه اسم دقیق رابطه‌ها،
 * و اولین تلاش برای گرفتن کارت‌ها با HTTP 500 برگشت. پس به‌جای یک کوئریِ بزرگ،
 * چندتا کوئریِ کوچک و مستقل می‌زنیم:
 *
 *  - فیلدهای کارت یکی‌یکی اضافه می‌شن، تا اگه یکی‌شون نامعتبره خودش لو بره
 *  - چند شکلِ مختلفِ گرفتنِ کارت امتحان می‌شه (از اکانت، از دک، با فیلتر)
 *
 * هیچ‌جای این فایل توکن نوشته نمی‌شه — فقط بدنه‌ی پاسخ.
 */
interface ProbeStep {
  label: string;
  query: unknown;
  /** برای مرحله‌هایی که به یک id از مرحله‌ی قبل نیاز دارن */
  needsDeckId?: boolean;
}

const CARD_FIELD_LADDER = [
  ["title"],
  ["title", "status"],
  ["title", "status", "content"],
  ["title", "status", "effort"],
  ["title", "status", "priority"],
  ["title", "status", "accountSeq"],
  ["title", "status", "createdAt"],
  ["title", "status", "dueDate"],
  ["title", "status", "deckId"],
  ["title", "status", "assigneeId"],
];

function baseSteps(): ProbeStep[] {
  const steps: ProbeStep[] = [
    { label: "account", query: { _root: [{ account: ["name"] }] } },
    { label: "projects", query: { _root: [{ account: [{ projects: ["name"] }] }] } },
    {
      label: "decks with projectId",
      query: { _root: [{ account: [{ decks: ["title", "projectId"] }] }] },
    },
    {
      label: "projects → decks (relation direction)",
      query: { _root: [{ account: [{ projects: ["name", { decks: ["title"] }] }] }] },
    },
  ];

  // نردبانِ فیلدهای کارت — هر پله یک فیلد بیشتر
  for (const fields of CARD_FIELD_LADDER) {
    steps.push({
      label: `cards fields: ${fields.join(", ")}`,
      query: { _root: [{ account: [{ cards: fields }] }] },
    });
  }

  // شکل‌های مختلفِ محدودکردن
  steps.push(
    {
      label: 'cards with $limit — cards({"$limit":5})',
      query: { _root: [{ account: [{ 'cards({"$limit":5})': ["title", "status"] }] }] },
    },
    {
      label: 'cards with filter — cards({"status":"done","$limit":5})',
      query: {
        _root: [{ account: [{ 'cards({"status":"done","$limit":5})': ["title", "status"] }] }],
      },
    },
    {
      label: "cards via decks",
      query: { _root: [{ account: [{ decks: ["title", { cards: ["title", "status"] }] }] }] },
    }
  );

  return steps;
}

export interface ProbeResult {
  notePath: string;
  statuses: string[];
  ok: number;
  failed: number;
}

export class Probe {
  constructor(private app: App, private client: CodecksClient) {}

  async run(): Promise<ProbeResult> {
    const out: string[] = [
      "# Codecks API probe",
      "",
      `Run at ${new Date().toISOString()}.`,
      "",
      "Each step is an independent query. Card fields are added one at a time so an",
      "invalid field shows up as the step where things start failing.",
      "",
    ];

    const statuses = new Set<string>();
    const summary: string[] = [];
    let ok = 0;
    let failed = 0;

    for (const step of baseSteps()) {
      try {
        const body = await this.client.query(step.query);
        for (const s of collectStatuses(body)) statuses.add(s);
        ok++;
        summary.push(`- ✅ ${step.label}`);
        out.push(
          `## ✅ ${step.label}`,
          "",
          "```json",
          JSON.stringify(step.query),
          "```",
          "",
          "```json",
          truncate(JSON.stringify(body, null, 2)),
          "```",
          ""
        );
      } catch (err) {
        failed++;
        const msg = err instanceof CodecksError ? `${err.kind}: ${err.message}` : String(err);
        summary.push(`- ❌ ${step.label} — ${msg}`);
        out.push(`## ❌ ${step.label}`, "", "```json", JSON.stringify(step.query), "```", "", "```", msg, "```", "");

        if (
          err instanceof CodecksError &&
          (err.kind === "auth" || err.kind === "no-token" || err.kind === "no-subdomain")
        ) {
          out.push("_Stopped early: every remaining step would fail the same way._", "");
          break;
        }
      }
    }

    const header = [
      "## Summary",
      "",
      ...summary,
      "",
      statuses.size
        ? `**Card statuses seen:** ${[...statuses].sort().map((s) => `\`${s}\``).join(", ")}`
        : "**No card statuses seen yet.**",
      "",
      "---",
      "",
    ];
    out.splice(6, 0, ...header);

    const notePath = normalizePath("Codecks API probe.md");
    await this.app.vault.adapter.write(notePath, out.join("\n"));

    return { notePath, statuses: [...statuses].sort(), ok, failed };
  }
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

const MAX_CHARS = 4000;

function truncate(text: string): string {
  return text.length <= MAX_CHARS
    ? text
    : `${text.slice(0, MAX_CHARS)}\n… truncated, ${text.length - MAX_CHARS} more characters`;
}
