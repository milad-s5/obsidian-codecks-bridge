import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CodecksBridgeSettings, DEFAULT_SETTINGS } from "./types";
import { CodecksBridgeSettingTab } from "./settings";
import { TokenStore } from "./auth/TokenStore";
import { CodecksClient, CodecksError } from "./api/CodecksClient";
import { Probe } from "./api/Probe";
import { CodecksView, CODECKS_VIEW_TYPE } from "./views/CodecksView";
import { Importer, PmApi } from "./import/Importer";
import { STYLES } from "./styles";

const PM_PLUGIN_ID = "project-manager-with-time-tracking";

/** Lowest Project Manager API version this plugin can work against */
const REQUIRED_PM_API = 1;

export default class CodecksBridgePlugin extends Plugin {
  settings: CodecksBridgeSettings;
  tokens: TokenStore;
  client: CodecksClient;
  private styleEl: HTMLStyleElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.tokens = new TokenStore(
      this.app,
      this.manifest.dir ?? `.obsidian/plugins/${this.manifest.id}`
    );
    this.client = new CodecksClient(this.app, this.tokens, () => this.settings.subdomain);

    this.loadStyles();
    this.registerView(CODECKS_VIEW_TYPE, (leaf: WorkspaceLeaf) => new CodecksView(leaf, this));
    this.addSettingTab(new CodecksBridgeSettingTab(this.app, this));

    this.addRibbonIcon("layers", "Open Codecks", () => void this.openView());

    this.addCommand({
      id: "open",
      name: "Open Codecks",
      callback: () => void this.openView(),
    });

    this.addCommand({
      id: "probe",
      name: "Test connection and probe the API",
      callback: () => void this.runProbe(),
    });
  }

  onunload(): void {
    this.styleEl?.remove();
    this.styleEl = null;
  }

  async loadSettings(): Promise<void> {
    const stored = ((await this.loadData()) ?? {}) as Partial<CodecksBridgeSettings>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);

    // statusMap has to merge key by key rather than be replaced wholesale. The
    // first build stored a guessed map (unassigned/assigned); replacing it
    // outright meant not_started — the value the account actually returns —
    // never reached an existing install and quietly fell through to defaultStatus.
    this.settings.statusMap = { ...DEFAULT_SETTINGS.statusMap, ...(stored.statusMap ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private loadStyles(): void {
    const el = document.createElement("style");
    el.id = "codecks-bridge-styles";
    el.textContent = STYLES;
    document.head.appendChild(el);
    this.styleEl = el;
  }

  async openView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(CODECKS_VIEW_TYPE);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.setViewState({ type: CODECKS_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  /** Project Manager's API, or null if it is missing or older than we need */
  pmApi(): PmApi | null {
    const api = (this.app as any).plugins?.plugins?.[PM_PLUGIN_ID]?.api as PmApi | undefined;
    if (!api || typeof api.version !== "number" || api.version < REQUIRED_PM_API) return null;
    return api;
  }

  importer(): Importer | null {
    const api = this.pmApi();
    return api ? new Importer(api, this.settings) : null;
  }

  pmWorkspaces(): { id: string; name: string }[] {
    try {
      return this.pmApi()?.listWorkspaces() ?? [];
    } catch {
      return [];
    }
  }

  async runProbe(): Promise<void> {
    new Notice("Probing the Codecks API…");
    try {
      const result = await new Probe(this.app, this.client).run();
      const statusPart = result.statuses.length
        ? ` Statuses seen: ${result.statuses.join(", ")}.`
        : "";
      new Notice(
        `Probe written to "${result.notePath}" — ${result.ok} ok, ${result.failed} failed.${statusPart}`,
        10000
      );
    } catch (err) {
      const msg = err instanceof CodecksError ? err.message : "Probe failed. See the console.";
      new Notice(msg, 8000);
      if (!(err instanceof CodecksError)) console.error("[codecks-bridge] probe failed", err);
    }
  }
}
