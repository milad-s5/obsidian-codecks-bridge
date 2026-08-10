import { Notice, Plugin } from "obsidian";
import { CodecksBridgeSettings, DEFAULT_SETTINGS } from "./types";
import { CodecksBridgeSettingTab } from "./settings";
import { TokenStore } from "./auth/TokenStore";
import { CodecksClient, CodecksError } from "./api/CodecksClient";
import { Probe } from "./api/Probe";

const PM_PLUGIN_ID = "project-manager-with-time-tracking";

/** حداقل نسخه‌ی APIای که این پلاگین باهاش کار می‌کنه */
const REQUIRED_PM_API = 1;

interface ProjectManagerApi {
  version: number;
  listWorkspaces(): { id: string; name: string }[];
}

export default class CodecksBridgePlugin extends Plugin {
  settings: CodecksBridgeSettings;
  tokens: TokenStore;
  client: CodecksClient;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.tokens = new TokenStore(this.app, this.manifest.dir ?? `.obsidian/plugins/${this.manifest.id}`);
    this.client = new CodecksClient(this.app, this.tokens, () => this.settings.subdomain);

    this.addSettingTab(new CodecksBridgeSettingTab(this.app, this));

    this.addCommand({
      id: "probe",
      name: "Test connection and probe the API",
      callback: () => void this.runProbe(),
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** APIِ Project Manager — اگه نباشه یا قدیمی باشه null */
  pmApi(): ProjectManagerApi | null {
    const plugins = (this.app as any).plugins?.plugins;
    const api = plugins?.[PM_PLUGIN_ID]?.api as ProjectManagerApi | undefined;
    if (!api || typeof api.version !== "number" || api.version < REQUIRED_PM_API) return null;
    return api;
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
