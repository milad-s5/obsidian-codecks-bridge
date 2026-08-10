import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type CodecksBridgePlugin from "./main";

export class CodecksBridgeSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: CodecksBridgePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Codecks Bridge" });

    new Setting(containerEl)
      .setName("Subdomain")
      .setDesc("Your Codecks organisation subdomain — the part before .codecks.io")
      .addText((text) =>
        text
          .setPlaceholder("my-studio")
          .setValue(this.plugin.settings.subdomain)
          .onChange(async (value) => {
            this.plugin.settings.subdomain = value.trim();
            await this.plugin.saveSettings();
          })
      );

    this.renderTokenSetting(containerEl);
    this.renderWorkspaceSetting(containerEl);

    new Setting(containerEl)
      .setName("Test connection")
      .setDesc("Runs a few read-only queries and writes what came back to a note in your vault.")
      .addButton((btn) =>
        btn.setButtonText("Run probe").onClick(async () => {
          btn.setDisabled(true).setButtonText("Running…");
          try {
            await this.plugin.runProbe();
          } finally {
            btn.setDisabled(false).setButtonText("Run probe");
          }
        })
      );
  }

  /**
   * توکن هیچ‌وقت به DOM برنمی‌گرده. اگه ذخیره شده باشه فقط می‌گیم ذخیره شده و دو
   * دکمه‌ی جایگزینی و پاک‌کردن می‌دیم.
   */
  private renderTokenSetting(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName("Access token")
      .setDesc(
        createFragment((frag) => {
          frag.appendText("Stored outside data.json, in a gitignored file, so it is never committed. ");
          frag.createEl("strong", { text: "Use a read-only observer account's token" });
          frag.appendText(
            " — a normal token can act as you across every organisation, and on mobile there is no OS keychain to protect it."
          );
        })
      );

    void this.plugin.tokens.has().then((has) => {
      if (has) {
        setting.descEl.createEl("div", {
          text: "A token is saved. It is not displayed again.",
          cls: "mod-success",
        });
        setting.addButton((btn) =>
          btn.setButtonText("Replace").onClick(() => {
            this.promptForToken();
          })
        );
        setting.addButton((btn) =>
          btn
            .setButtonText("Clear")
            .setWarning()
            .onClick(async () => {
              await this.plugin.tokens.clear();
              new Notice("Codecks token cleared");
              this.display();
            })
        );
      } else {
        setting.addText((text) => {
          text.setPlaceholder("paste token, then press Enter");
          text.inputEl.type = "password";
          text.inputEl.autocapitalize = "off";
          text.inputEl.spellcheck = false;
          text.inputEl.addEventListener("keydown", async (e: KeyboardEvent) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            await this.saveToken(text.getValue());
            text.setValue("");
          });
        });
      }
    });
  }

  private promptForToken(): void {
    const input = window.prompt("Paste the new Codecks token. It will not be shown again.");
    if (input === null) return;
    void this.saveToken(input);
  }

  private async saveToken(raw: string): Promise<void> {
    const value = raw.trim();
    if (!value) {
      new Notice("Nothing to save");
      return;
    }
    await this.plugin.tokens.write(value);
    new Notice("Codecks token saved");
    this.display();
  }

  private renderWorkspaceSetting(containerEl: HTMLElement): void {
    const workspaces = this.plugin.pmWorkspaces();
    const setting = new Setting(containerEl)
      .setName("Import into")
      .setDesc("Which Project Manager workspace imported cards land in.");

    if (!workspaces.length) {
      setting.descEl.createEl("div", {
        text: "Project Manager was not found, or it is older than the version that exposes an API.",
        cls: "mod-warning",
      });
      return;
    }

    setting.addDropdown((drop) => {
      workspaces.forEach((ws) => drop.addOption(ws.id, ws.name));
      const current = workspaces.some((w) => w.id === this.plugin.settings.targetWorkspaceId)
        ? this.plugin.settings.targetWorkspaceId
        : workspaces[0].id;
      drop.setValue(current);
      this.plugin.settings.targetWorkspaceId = current;
      drop.onChange(async (value) => {
        this.plugin.settings.targetWorkspaceId = value;
        await this.plugin.saveSettings();
      });
    });
  }
}
