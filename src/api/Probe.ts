import { App, normalizePath } from "obsidian";
import { CodecksClient, CodecksError } from "./CodecksClient";

/**
 * فاز کشف. مستندات Codecks نه مقادیر واقعیِ status رو می‌گه نه اسم دقیق رابطه‌ها،
 * پس به‌جای حدس‌زدن، چندتا کوئریِ نامزد رو می‌زنیم و پاسخِ خام رو می‌ریزیم توی یه
 * نوت تا از روی داده‌ی واقعی تصمیم بگیریم.
 *
 * هیچ‌جای این فایل توکن نوشته نمی‌شه — فقط بدنه‌ی پاسخ.
 */
interface ProbeStep {
  label: string;
  query: unknown;
}

const STEPS: ProbeStep[] = [
  {
    label: "account",
    query: { _root: [{ account: ["name"] }] },
  },
  {
    label: "projects",
    query: { _root: [{ account: [{ projects: ["name"] }] }] },
  },
  {
    label: "decks",
    query: { _root: [{ account: [{ decks: ["title"] }] }] },
  },
  {
    label: "cards (sample of 20)",
    query: {
      _root: [
        {
          account: [
            {
              'cards({"$limit":20})': [
                "title",
                "status",
                "effort",
                "priority",
                "accountSeq",
                "createdAt",
              ],
            },
          ],
        },
      ],
    },
  },
];

export interface ProbeResult {
  notePath: string;
  statuses: string[];
  failures: number;
}

export class Probe {
  constructor(private app: App, private client: CodecksClient) {}

  async run(): Promise<ProbeResult> {
    const chunks: string[] = [
      "# Codecks API probe",
      "",
      `Run at ${new Date().toISOString()}.`,
      "",
      "Raw responses below — used to pin down the real `status` values and relation",
      "names before the importer is written. Safe to delete afterwards.",
      "",
    ];

    const statuses = new Set<string>();
    let failures = 0;

    for (const step of STEPS) {
      chunks.push(`## ${step.label}`, "");
      chunks.push("Query:", "", "```json", JSON.stringify(step.query, null, 2), "```", "");
      try {
        const body = await this.client.query(step.query);
        for (const s of collectStatuses(body)) statuses.add(s);
        chunks.push("Response:", "", "```json", truncate(JSON.stringify(body, null, 2)), "```", "");
      } catch (err) {
        failures++;
        const msg = err instanceof CodecksError ? `${err.kind}: ${err.message}` : String(err);
        chunks.push("Failed:", "", "```", msg, "```", "");
        // شکستِ احراز هویت روی همه‌ی مرحله‌ها تکرار می‌شه — زودتر تمومش کن
        if (err instanceof CodecksError && (err.kind === "auth" || err.kind === "no-token" || err.kind === "no-subdomain")) {
          chunks.push("_Stopped early: the remaining steps would fail the same way._", "");
          break;
        }
      }
    }

    if (statuses.size) {
      chunks.push("## Distinct card statuses seen", "", ...[...statuses].sort().map((s) => `- \`${s}\``), "");
    }

    const notePath = normalizePath("Codecks API probe.md");
    await this.app.vault.adapter.write(notePath, chunks.join("\n"));

    return { notePath, statuses: [...statuses].sort(), failures };
  }
}

/** هر جای پاسخ که کلیدِ status با مقدار رشته‌ای باشه رو جمع می‌کنه */
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

const MAX_CHARS = 20000;

function truncate(text: string): string {
  return text.length <= MAX_CHARS
    ? text
    : `${text.slice(0, MAX_CHARS)}\n… truncated, ${text.length - MAX_CHARS} more characters`;
}
