export interface CodecksBridgeSettings {
  /** زیردامنه‌ی سازمان در Codecks — هدرِ X-Account */
  subdomain: string;
  /** workspace مقصد در Project Manager (شناسه، نه نام) */
  targetWorkspaceId: string;
  /** status کارت در Codecks → status در Project Manager */
  statusMap: Record<string, string>;
  /** status پیش‌فرض وقتی نگاشتی وجود نداره */
  defaultStatus: string;
}

export const DEFAULT_SETTINGS: CodecksBridgeSettings = {
  subdomain: "",
  targetWorkspaceId: "",
  // مقادیر واقعیِ status بعد از probe نهایی می‌شن — این‌ها حدسِ اولیه‌ان
  statusMap: {
    done: "done",
    started: "active",
    review: "active",
    blocked: "active",
    assigned: "todo",
    unassigned: "todo",
  },
  defaultStatus: "todo",
};

export interface CodecksCard {
  id: string;
  /** شماره‌ی قابل‌خواندنِ کارت (همونی که توی URL می‌بینی) */
  accountSeq: number | null;
  title: string;
  content: string;
  status: string;
  effort: number | null;
  priority: string;
  dueDate: string;
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
