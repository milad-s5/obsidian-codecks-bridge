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
            "content",
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

/** Card address in the web app, from its human-readable number */
export function cardUrl(subdomain: string, accountSeq: number | null): string {
  if (accountSeq === null) return "";
  return `https://${subdomain}.codecks.io/card/${accountSeq}`;
}
