/**
 * These queries follow what the probe showed against the real account, not guesswork.
 *
 * What it taught us, honoured here:
 *  - assigneeId is not a valid field and 500s; assignee works as a nested relation
 *  - $limit is rejected in every form (filters and $order are fine). The account
 *    is only a few hundred cards, so we skip paging and take them all at once
 *  - three separate queries rather than one combined: all three were verified
 */

export const PROJECTS_QUERY = {
  _root: [{ account: [{ projects: ["name"] }] }],
};

export const DECKS_QUERY = {
  _root: [{ account: [{ decks: ["title", "projectId"] }] }],
};

export const CARDS_QUERY = {
  _root: [
    {
      account: [
        {
          cards: [
            "title",
            "status",
            // content is deliberately absent: it is the bulk of the payload and
            // most of it is never read. deckBodiesQuery pulls it a deck at a time.
            "effort",
            "priority",
            "accountSeq",
            "createdAt",
            "dueDate",
            "deckId",
            "isDoc",
            // default | archived | deleted — the only thing that marks deletion.
            // deletedAt, archivedAt and isArchived all 500.
            "visibility",
            { assignee: ["name"] },
          ],
        },
      ],
    },
  ],
};

/**
 * The card bodies for a single deck.
 *
 * Filters in this `field({...})` form are known to work — the probe confirmed
 * cards({"status":"done"}) — and this leans on the same shape with deckId.
 * If it ever stops working the sheet still lists its cards; only the body text
 * is missing, and the view says so.
 */
export function deckBodiesQuery(deckId: string): unknown {
  const filter = JSON.stringify({ deckId });
  return { _root: [{ account: [{ [`cards(${filter})`]: ["content"] }] }] };
}
