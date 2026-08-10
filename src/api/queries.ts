/**
 * کوئری‌ها بر اساس چیزی که probe روی حساب واقعی نشون داد نوشته شدن، نه حدس.
 *
 * چیزهایی که یاد گرفتیم و اینجا رعایت شدن:
 *  - assigneeId فیلد معتبری نیست و ۵۰۰ می‌ده؛ assignee به‌شکل رابطه‌ی تودرتو جواب می‌ده
 *  - $limit در هیچ شکلی پذیرفته نمی‌شه (فیلتر و $order می‌شن). چون کل حساب چند صد
 *    کارته، بی‌خیالِ صفحه‌بندی می‌شیم و همه رو یک‌جا می‌گیریم
 *  - سه کوئری جدا می‌زنیم نه یکی ترکیبی: هر سه تک‌به‌تک تأیید شدن
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
            { assignee: ["name"] },
          ],
        },
      ],
    },
  ],
};

/** آدرسِ کارت در وب‌اپ، از روی شماره‌ی قابل‌خواندنش */
export function cardUrl(subdomain: string, accountSeq: number | null): string {
  if (accountSeq === null) return "";
  return `https://${subdomain}.codecks.io/card/${accountSeq}`;
}
