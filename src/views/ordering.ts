/**
 * Display order for projects and spaces.
 *
 * Kept apart from the view so it can be tested without Obsidian: the awkward
 * cases here are all about lists that drift — a saved order naming things that
 * no longer exist, and things that exist but were never ordered.
 */

/**
 * Numeric-aware and case-insensitive, so "Space 2" comes before "Space 10" and
 * "peach" sits next to "Peach". Plain string comparison got both wrong.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Saved order first, everything else after it by label.
 *
 * A project or space that turns up later therefore lands at the end instead of
 * shoving into the middle of an arrangement someone set by hand, and an entry
 * left over in the saved order simply has no effect.
 *
 * @param labelOf what to sort the unordered remainder by — the key itself
 *        unless the thing is shown under a different name
 */
export function applyOrder(
  keys: string[],
  order: string[],
  labelOf: (key: string) => string = (k) => k
): string[] {
  const rank = new Map(order.map((k, i) => [k, i]));
  return [...keys].sort((a, b) => {
    const ra = rank.get(a);
    const rb = rank.get(b);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return collator.compare(labelOf(a), labelOf(b));
  });
}

/**
 * Moves one key by delta within an already-ordered list.
 *
 * Returns null when the move cannot happen — key absent, or already at the end
 * it is being pushed towards — so the caller can skip saving.
 */
export function moveWithin(ordered: string[], key: string, delta: number): string[] | null {
  const from = ordered.indexOf(key);
  if (from < 0) return null;
  const to = from + delta;
  if (to < 0 || to >= ordered.length) return null;
  const next = [...ordered];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * What a space is called: the user's own name if they set one, otherwise the
 * id. The API has no name to offer — every route to one returns 500 — so this
 * is the only place a readable label can come from.
 */
export function spaceLabel(
  names: Record<string, string>,
  key: string,
  spaceId: string
): string {
  const custom = (names[key] ?? "").trim();
  if (custom) return custom;
  return spaceId === "none" ? "Unfiled" : `Space ${spaceId}`;
}
