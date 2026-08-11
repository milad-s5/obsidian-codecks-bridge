import { App, normalizePath } from "obsidian";
import { CodecksClient, CodecksError } from "./CodecksClient";

/**
 * Discovery phase — round four.
 *
 * Earlier rounds settled the shape of cards, decks and projects. Two things are
 * left, and guessing at them has been wrong every single time:
 *
 *  1. Spaces — do decks sit under one? What is the field or relation called?
 *  2. What marks a card as deleted? deletedAt? archived? visibility?
 *
 * For each suspect field the distinct values actually returned are reported —
 * knowing a field exists is not the same as knowing what it holds.
 */
interface ProbeStep {
  label: string;
  query: unknown;
  /** Fields whose distinct values we want counted */
  collect?: string[];
}

/** Fields a card URL might be built from */
const URL_FIELD_CANDIDATES = ["slug", "shortId", "hashId", "cardHash", "seq", "url", "link", "key"];

const STEPS: ProbeStep[] = (() => {
  const steps: ProbeStep[] = [
    // ── Spaces: they exist, but where does a name come from? ──────────
    {
      label: "deck.spaceId — how many distinct spaces are there?",
      query: { _root: [{ account: [{ decks: ["title", "spaceId"] }] }] },
      collect: ["spaceId"],
    },
    {
      label: "space entity by id — space(1)",
      query: { "space(1)": ["name"] },
    },
    {
      label: "account.spaces with id instead of name",
      query: { _root: [{ account: [{ spaces: ["id"] }] }] },
    },
    {
      label: "deck.space_id (snake, like project_id)",
      query: { _root: [{ account: [{ decks: ["title", "space_id"] }] }] },
      collect: ["space_id"],
    },
  ];

  // ── Card URL: one candidate per step, so whichever exists reveals itself ─
  for (const field of URL_FIELD_CANDIDATES) {
    steps.push({
      label: `card.${field}`,
      query: { _root: [{ account: [{ cards: ["title", field] }] }] },
      collect: [field],
    });
  }

  return steps;
})();

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
        for (const s of distinct(res, "status").keys()) statuses.add(String(s));
        ok++;
        summary.push(`- ✅ ${step.label}`);
        body.push(`## ✅ ${step.label}`, "", "```json", JSON.stringify(step.query), "```", "");

        for (const field of step.collect ?? []) {
          const counts = distinct(res, field);
          body.push(
            counts.size
              ? `\`${field}\` values: ` +
                  [...counts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([v, n]) => `\`${v}\` ×${n}`)
                    .join(", ")
              : `\`${field}\`: never present in the response`,
            ""
          );
        }
        body.push(...describe(res), "");
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
      "Looking for two things: a field the card URL can be built from, and whether",
      "a space name is reachable at all (spaceId exists on decks but is a bare",
      "integer, and every route to a space entity has 500'd so far).",
      "",
      "## Summary",
      "",
      ...summary,
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

/** Distinct values of a field across the whole response, with counts */
function distinct(node: unknown, field: string, acc = new Map<string, number>(), depth = 0): Map<string, number> {
  if (depth > 8 || node === null || typeof node !== "object") return acc;
  if (Array.isArray(node)) {
    for (const item of node) distinct(item, field, acc, depth + 1);
    return acc;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === field) {
      const label = value === null ? "null" : typeof value === "object" ? "<object>" : String(value);
      acc.set(label, (acc.get(label) ?? 0) + 1);
    } else {
      distinct(value, field, acc, depth + 1);
    }
  }
  return acc;
}

function describe(res: unknown): string[] {
  if (res === null || typeof res !== "object") return ["```", String(res), "```"];
  const out: string[] = [];
  for (const [type, value] of Object.entries(res as Record<string, unknown>)) {
    if (type === "_root" || type === "account") continue;
    if (value === null || typeof value !== "object") continue;
    const entries = Object.entries(value as Record<string, unknown>);
    out.push(`**${type}** — ${entries.length} item(s)`, "");
    const [, sample] = entries[0] ?? [];
    if (sample !== undefined) {
      out.push("```json", trim(JSON.stringify(sample, null, 2), 700), "```", "");
    }
  }
  return out;
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n… ${text.length - max} more`;
}
