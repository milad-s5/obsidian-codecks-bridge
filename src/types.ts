export interface CodecksBridgeSettings {
  /** Codecks organisation subdomain — the X-Account header */
  subdomain: string;
  /** Target Project Manager workspace (id, not name) */
  targetWorkspaceId: string;
  /** Last project picked in the view — survives closing and reopening */
  lastProjectId: string;
  /** Codecks card status → Project Manager status */
  statusMap: Record<string, string>;
  /** Fallback status when nothing maps */
  defaultStatus: string;
  /** isDoc cards are documents rather than tasks — skipped by default */
  skipDocs: boolean;
}

export const DEFAULT_SETTINGS: CodecksBridgeSettings = {
  subdomain: "",
  targetWorkspaceId: "",
  lastProjectId: "",
  // These keys came from probing the real account. not_started is what disproved
  // my first guess of unassigned/assigned.
  statusMap: {
    not_started: "todo",
    started: "active",
    blocked: "active",
    review: "active",
    done: "done",
  },
  defaultStatus: "todo",
  skipDocs: true,
};

export interface CodecksCard {
  id: string;
  /** Human-readable card number, the one shown in the app */
  accountSeq: number | null;
  title: string;
  content: string;
  status: string;
  effort: number | null;
  priority: string;
  dueDate: string;
  /** A document card, not a task */
  isDoc: boolean;
  /** default | archived | deleted — the real deletion marker, per the probe */
  visibility: string;
  deckId: string;
  deckName: string;
  projectId: string;
  projectName: string;
  assigneeName: string;
  createdAt: string;
}

export interface CodecksProject {
  id: string;
  name: string;
  deckIds: string[];
}

export interface CodecksDeck {
  id: string;
  title: string;
  projectId: string;
}
