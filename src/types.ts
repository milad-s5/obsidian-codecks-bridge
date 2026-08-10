export interface CodecksBridgeSettings {
  /** زیردامنه‌ی سازمان در Codecks — هدرِ X-Account */
  subdomain: string;
  /** workspace مقصد در Project Manager (شناسه، نه نام) */
  targetWorkspaceId: string;
  /** status کارت در Codecks → status در Project Manager */
  statusMap: Record<string, string>;
  /** status پیش‌فرض وقتی نگاشتی وجود نداره */
  defaultStatus: string;
  /** کارت‌های isDoc داکیومنتن نه تسک — پیش‌فرض نادیده گرفته می‌شن */
  skipDocs: boolean;
}

export const DEFAULT_SETTINGS: CodecksBridgeSettings = {
  subdomain: "",
  targetWorkspaceId: "",
  // مقادیرِ چپ از probe روی حساب واقعی اومدن. not_started چیزی بود که حدس اولیه‌ام
  // (unassigned/assigned) رو رد کرد.
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
  /** شماره‌ی قابل‌خواندنِ کارت (همونی که توی URL می‌بینی) */
  accountSeq: number | null;
  title: string;
  content: string;
  status: string;
  effort: number | null;
  priority: string;
  dueDate: string;
  /** کارتِ داکیومنت، نه تسک */
  isDoc: boolean;
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
