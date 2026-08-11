import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type CodecksBridgePlugin from "../main";
import { CodecksCard, CodecksDeck, CodecksProject } from "../types";
import { CARDS_QUERY, DECKS_QUERY, PROJECTS_QUERY, cardUrl } from "../api/queries";
import { displayTitle, parseCards, parseDecks, parseProjects } from "../api/normalize";
import { CodecksError } from "../api/CodecksClient";
import { Importer } from "../import/Importer";

export const CODECKS_VIEW_TYPE = "codecks-bridge-view";

/**
 * A card with no work left: either its status is finished, or it is off the board.
 *
 * The probe showed deletion and archiving live in visibility (default / archived /
 * deleted) rather than deletedAt or isArchived — those do not exist at all and 500
 * on sight. On this account 76 of 208 cards were archived or deleted.
 */
const CLOSED_STATUSES = new Set(["done", "cancelled", "canceled"]);

function isClosed(card: CodecksCard): boolean {
  if (CLOSED_STATUSES.has((card.status ?? "").trim().toLowerCase())) return true;
  return (card.visibility ?? "default") !== "default";
}

export class CodecksView extends ItemView {
  private cards: CodecksCard[] = [];
  private decks: CodecksDeck[] = [];
  private projects: CodecksProject[] = [];
  private selected = new Set<string>();
  private imported = new Set<string>();

  private filterText = "";
  private filterProject = "";
  private hideDocs = true;
  private hideImported = true;
  private hideClosed = true;
  private loading = false;
  private loadError = "";
  /** Groups the user has collapsed — everything starts open */
  private collapsed = new Set<string>();

  constructor(leaf: WorkspaceLeaf, private plugin: CodecksBridgePlugin) {
    super(leaf);
    this.filterProject = plugin.settings.lastProjectId ?? "";
  }

  getViewType(): string { return CODECKS_VIEW_TYPE; }
  getDisplayText(): string { return "Codecks"; }
  getIcon(): string { return "layers"; }

  async onOpen(): Promise<void> {
    this.render();
    if (await this.plugin.tokens.has()) void this.fetch();
  }

  // ── Data ──────────────────────────────────────────────────────────────

  private async fetch(): Promise<void> {
    this.loading = true;
    this.loadError = "";
    this.render();
    try {
      // Three separate queries — each verified individually by the probe
      const projectsRes = await this.plugin.client.query(PROJECTS_QUERY);
      const decksRes = await this.plugin.client.query(DECKS_QUERY);
      const cardsRes = await this.plugin.client.query(CARDS_QUERY);

      this.projects = parseProjects(projectsRes);
      this.decks = parseDecks(decksRes);
      this.cards = parseCards(cardsRes, { decks: this.decks, projects: this.projects });
      this.refreshImportedMarks();
    } catch (err) {
      this.loadError = err instanceof CodecksError ? err.message : "Could not load from Codecks.";
      if (!(err instanceof CodecksError)) console.error("[codecks-bridge]", err);
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private refreshImportedMarks(): void {
    const ws = this.plugin.settings.targetWorkspaceId;
    const importer = this.plugin.importer();
    this.imported.clear();
    if (!ws || !importer) return;
    for (const card of this.cards) {
      if (importer.alreadyImported(ws, card)) this.imported.add(card.id);
    }
  }

  private visibleCards(): CodecksCard[] {
    const text = this.filterText.trim().toLowerCase();
    return this.cards.filter((c) => {
      // A card attached to no project is not something anyone created — hide it
      if (!c.projectId) return false;
      if (this.hideDocs && c.isDoc) return false;
      if (this.hideClosed && isClosed(c)) return false;
      if (this.hideImported && this.imported.has(c.id)) return false;
      if (this.filterProject && c.projectId !== this.filterProject) return false;
      if (text && !`${displayTitle(c)} ${c.deckName}`.toLowerCase().includes(text)) return false;
      return true;
    });
  }

  /**
   * Groups cards project → deck. Sorted by name so the order holds steady between
   * refreshes.
   */
  private grouped(cards: CodecksCard[]): { project: string; decks: { deck: string; cards: CodecksCard[] }[] }[] {
    const byProject = new Map<string, Map<string, CodecksCard[]>>();
    for (const card of cards) {
      const project = card.projectName || "No project";
      const deck = card.deckName || "No deck";
      let decks = byProject.get(project);
      if (!decks) byProject.set(project, (decks = new Map()));
      const list = decks.get(deck);
      if (list) list.push(card);
      else decks.set(deck, [card]);
    }

    const byName = (a: string, b: string) => a.localeCompare(b);
    return [...byProject.entries()]
      .sort((a, b) => byName(a[0], b[0]))
      .map(([project, decks]) => ({
        project,
        decks: [...decks.entries()]
          .sort((a, b) => byName(a[0], b[0]))
          .map(([deck, cards]) => ({ deck, cards })),
      }));
  }

  // ── Render ────────────────────────────────────────────────────────────

  private render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("cdx-root");

    this.renderToolbar(root);

    if (this.loading) {
      root.createDiv({ cls: "cdx-empty", text: "Loading from Codecks…" });
      return;
    }
    if (this.loadError) {
      root.createDiv({ cls: "cdx-error", text: this.loadError });
      return;
    }
    if (!this.cards.length) {
      root.createDiv({
        cls: "cdx-empty",
        text: "Nothing loaded yet. Add your subdomain and token in settings, then hit Refresh.",
      });
      return;
    }

    const visible = this.visibleCards();
    const counts = root.createDiv({ cls: "cdx-counts" });
    counts.setText(
      `${visible.length} shown · ${this.selected.size} selected · ` +
        `${this.imported.size} already imported · ${this.cards.length} total`
    );

    const list = root.createDiv({ cls: "cdx-list" });
    if (!visible.length) {
      list.createDiv({ cls: "cdx-empty", text: "No cards match these filters." });
      return;
    }

    for (const group of this.grouped(visible)) {
      const total = group.decks.reduce((n, d) => n + d.cards.length, 0);
      const isCollapsed = this.collapsed.has(group.project);

      const header = list.createDiv({ cls: "cdx-group-head" });
      header.createSpan({ cls: "cdx-caret", text: isCollapsed ? "▸" : "▾" });
      header.createSpan({ cls: "cdx-group-name", text: group.project });
      header.createSpan({ cls: "cdx-group-count", text: String(total) });
      header.addEventListener("click", () => {
        if (isCollapsed) this.collapsed.delete(group.project);
        else this.collapsed.add(group.project);
        this.render();
      });

      const pick = header.createEl("button", { cls: "cdx-mini", text: "select" });
      pick.addEventListener("click", (e) => {
        e.stopPropagation();
        for (const d of group.decks) for (const c of d.cards) this.selected.add(c.id);
        this.render();
      });

      if (isCollapsed) continue;

      for (const { deck, cards } of group.decks) {
        const deckHead = list.createDiv({ cls: "cdx-deck-head" });
        deckHead.createSpan({ cls: "cdx-deck-name", text: deck });
        deckHead.createSpan({ cls: "cdx-group-count", text: String(cards.length) });

        const deckPick = deckHead.createEl("button", { cls: "cdx-mini", text: "select" });
        deckPick.addEventListener("click", (e) => {
          e.stopPropagation();
          for (const c of cards) this.selected.add(c.id);
          this.render();
        });

        for (const card of cards) this.renderCard(list, card);
      }
    }
  }

  private renderToolbar(root: HTMLElement): void {
    const bar = root.createDiv({ cls: "cdx-toolbar" });

    const refresh = bar.createEl("button", { cls: "cdx-btn", text: "Refresh" });
    refresh.addEventListener("click", () => void this.fetch());

    this.renderWorkspacePicker(bar);

    const projectSelect = bar.createEl("select", { cls: "cdx-select" });
    projectSelect.createEl("option", { value: "", text: "All projects" });
    for (const p of this.projects) {
      const opt = projectSelect.createEl("option", { value: p.id, text: p.name });
      if (p.id === this.filterProject) opt.selected = true;
    }
    projectSelect.addEventListener("change", () => {
      this.filterProject = projectSelect.value;
      // The choice should still be here next time
      this.plugin.settings.lastProjectId = this.filterProject;
      void this.plugin.saveSettings();
      this.render();
    });

    const search = bar.createEl("input", {
      cls: "cdx-search",
      type: "text",
      placeholder: "Filter by title or deck…",
    });
    search.value = this.filterText;
    search.addEventListener("input", () => {
      this.filterText = search.value;
      this.render();
    });

    this.renderToggle(bar, "Hide docs", this.hideDocs, (v) => { this.hideDocs = v; });
    this.renderToggle(bar, "Hide done", this.hideClosed, (v) => { this.hideClosed = v; });
    this.renderToggle(bar, "Hide imported", this.hideImported, (v) => { this.hideImported = v; });

    const spacer = bar.createDiv({ cls: "cdx-spacer" });
    spacer.setText("");

    const selectAll = bar.createEl("button", { cls: "cdx-btn", text: "Select shown" });
    selectAll.addEventListener("click", () => {
      for (const c of this.visibleCards()) this.selected.add(c.id);
      this.render();
    });

    const clear = bar.createEl("button", { cls: "cdx-btn", text: "Clear" });
    clear.addEventListener("click", () => {
      this.selected.clear();
      this.render();
    });

    const importBtn = bar.createEl("button", {
      cls: "cdx-btn cdx-btn-cta",
      text: `Import ${this.selected.size || ""}`.trim(),
    });
    importBtn.disabled = this.selected.size === 0;
    importBtn.addEventListener("click", () => void this.runImport());
  }

  /**
   * Target workspace picker, right beside the Import button. It used to live only
   * in settings, which left no way to tell where an import would land.
   */
  private renderWorkspacePicker(bar: HTMLElement): void {
    const workspaces = this.plugin.pmWorkspaces();
    if (!workspaces.length) {
      bar.createSpan({ cls: "cdx-warn", text: "Project Manager not found" });
      return;
    }

    const wrap = bar.createEl("label", { cls: "cdx-ws" });
    wrap.createSpan({ cls: "cdx-ws-label", text: "into" });
    const select = wrap.createEl("select", { cls: "cdx-select" });

    // If nothing is chosen, take the first so Import is never without a target
    let current = this.plugin.settings.targetWorkspaceId;
    if (!workspaces.some((w) => w.id === current)) {
      current = workspaces[0].id;
      this.plugin.settings.targetWorkspaceId = current;
      void this.plugin.saveSettings();
    }

    for (const ws of workspaces) {
      const opt = select.createEl("option", { value: ws.id, text: ws.name });
      if (ws.id === current) opt.selected = true;
    }

    select.addEventListener("change", () => {
      this.plugin.settings.targetWorkspaceId = select.value;
      void this.plugin.saveSettings();
      // "already imported" depends on the workspace, so it has to be recomputed
      this.refreshImportedMarks();
      this.render();
    });
  }

  private renderToggle(
    bar: HTMLElement,
    label: string,
    value: boolean,
    set: (v: boolean) => void
  ): void {
    const wrap = bar.createEl("label", { cls: "cdx-toggle" });
    const box = wrap.createEl("input", { type: "checkbox" });
    box.checked = value;
    wrap.createSpan({ text: label });
    box.addEventListener("change", () => {
      set(box.checked);
      this.render();
    });
  }

  private renderCard(list: HTMLElement, card: CodecksCard): void {
    const isImported = this.imported.has(card.id);
    const row = list.createDiv({ cls: `cdx-card${isImported ? " imported" : ""}` });

    const box = row.createEl("input", { type: "checkbox", cls: "cdx-check" });
    box.checked = this.selected.has(card.id);
    box.addEventListener("change", () => {
      if (box.checked) this.selected.add(card.id);
      else this.selected.delete(card.id);
      // Only the counter and import button change — re-rendering the whole list on
      // every tick makes the scroll position jump
      this.refreshToolbarOnly();
    });

    const main = row.createDiv({ cls: "cdx-card-main" });
    const titleRow = main.createDiv({ cls: "cdx-card-title-row" });
    titleRow.createSpan({ cls: "cdx-card-title", text: displayTitle(card) });
    if (card.isDoc) titleRow.createSpan({ cls: "cdx-tag", text: "doc" });
    if (isImported) titleRow.createSpan({ cls: "cdx-tag cdx-tag-ok", text: "imported" });

    const meta = main.createDiv({ cls: "cdx-card-meta" });
    const bits: string[] = [];
    if (card.projectName) bits.push(card.projectName);
    if (card.deckName) bits.push(card.deckName);
    if (card.status) bits.push(card.status);
    if (card.effort !== null) bits.push(`${card.effort}pt`);
    if (card.assigneeName) bits.push(card.assigneeName);
    meta.setText(bits.join(" · "));

    // The "open in Codecks" link is gone: the URL built from accountSeq did not
    // reach the card, and its real format is still unknown. A broken link is worse
    // than no link; the next probe looks for a field to build one from.
    if (card.accountSeq !== null) {
      row.createSpan({ cls: "cdx-seq", text: `#${card.accountSeq}` });
    }
  }

  private refreshToolbarOnly(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    const counts = root.querySelector(".cdx-counts");
    if (counts) {
      counts.textContent =
        `${this.visibleCards().length} shown · ${this.selected.size} selected · ` +
        `${this.imported.size} already imported · ${this.cards.length} total`;
    }
    const btn = root.querySelector<HTMLButtonElement>(".cdx-btn-cta");
    if (btn) {
      btn.textContent = `Import ${this.selected.size || ""}`.trim();
      btn.disabled = this.selected.size === 0;
    }
  }

  // ── Import ────────────────────────────────────────────────────────────

  private async runImport(): Promise<void> {
    const importer = this.plugin.importer();
    if (!importer) {
      new Notice("Project Manager was not found, or it is too old to have an API.");
      return;
    }
    const ws = this.plugin.settings.targetWorkspaceId;
    if (!ws) {
      new Notice("Pick a Project Manager workspace in the plugin settings first.");
      return;
    }

    const chosen = this.cards.filter((c) => this.selected.has(c.id));
    if (!chosen.length) return;

    const notice = new Notice(`Importing 0/${chosen.length}…`, 0);
    try {
      const summary = await importer.importCards(ws, chosen, (done, total) => {
        notice.setMessage(`Importing ${done}/${total}…`);
      });
      notice.hide();

      const parts = [`${summary.imported} imported`];
      if (summary.skipped) parts.push(`${summary.skipped} already there`);
      if (summary.failed) parts.push(`${summary.failed} failed`);
      new Notice(parts.join(", "), 8000);

      if (summary.failed) {
        for (const o of summary.outcomes.filter((x) => x.result === "failed")) {
          console.error(`[codecks-bridge] ${displayTitle(o.card)}: ${o.reason}`);
        }
      }

      this.selected.clear();
      this.refreshImportedMarks();
      this.render();
    } catch (err) {
      notice.hide();
      new Notice("Import failed. See the console.");
      console.error("[codecks-bridge] import failed", err);
    }
  }
}
