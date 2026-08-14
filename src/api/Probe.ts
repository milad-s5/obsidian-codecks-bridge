import { App, normalizePath } from "obsidian";
import { CodecksClient, CodecksError } from "./CodecksClient";

/**
 * Discovery phase — round six.
 *
 * Two open questions, both of which have punished guessing before:
 *
 *  1. The section row above the decks ("Ideas" in the app). Decks carry a
 *     numeric spaceId with seven distinct values here, but every route to an
 *     entity holding its *name* has 500'd so far. This tries other names.
 *  2. Fetching one deck's card bodies on demand, so the initial load does not
 *     drag every card's text along with it.
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

/** Names the deck-section entity might go by — the "Ideas" row above the decks */
const SECTION_COLLECTIONS = ["deckSpaces", "sections", "deckGroups", "groups", "spaces"];

/** Relation names on a deck that might carry that section */
const DECK_SECTION_RELATIONS = ["deckSpace", "section", "deckGroup", "group"];

const STEPS: ProbeStep[] = (() => {
  const steps: ProbeStep[] = [];

  // ── The section row: collections on the account ───────────────────────
  for (const name of SECTION_COLLECTIONS) {
    steps.push({
      label: `account.${name}`,
      query: { _root: [{ account: [{ [name]: ["name"] }] }] },
    });
  }

  // ── The section row: relations hanging off a deck ─────────────────────
  for (const rel of DECK_SECTION_RELATIONS) {
    steps.push({
      label: `deck.${rel} as a relation`,
      query: { _root: [{ account: [{ decks: ["title", { [rel]: ["name"] }] }] }] },
    });
  }
  steps.push({
    label: "deck.spaceId + title, to pair ids with deck names by hand",
    query: { _root: [{ account: [{ decks: ["title", "spaceId"] }] }] },
    collect: ["spaceId"],
  });

  // ── Fetching card bodies for one deck only ────────────────────────────
  steps.push(
    {
      label: 'filter cards by deckId — cards({"deckId":"<first deck>"})',
      query: {
        _root: [
          {
            account: [
              { decks: ["title", { 'cards({"$order":"createdAt"})': ["title"] }] },
            ],
          },
        ],
      },
    },
    {
      label: 'fetch one card body by accountSeq — cards({"accountSeq":139})',
      query: {
        _root: [{ account: [{ 'cards({"accountSeq":139})': ["title", "content"] }] }],
      },
    },
    {
      label: "card entity by uuid — card(<uuid>)",
      query: { "card(dd609582-ada7-11f0-840c-67f99209c5cb)": ["title", "content"] },
    }
  );

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
