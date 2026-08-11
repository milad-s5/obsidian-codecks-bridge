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
   * The token never goes back into the DOM — the field starts empty and is
   * cleared again once saved.
   *
   * Saving is a button rather than Enter: on a phone keyboard Enter is often
   * not reachable at all, or merely dismisses the field.
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

    const status = setting.descEl.createEl("div", { text: "Checking…" });

    let field: { getValue(): string; setValue(v: string): unknown } | null = null;

    setting.addText((text) => {
      field = text;
      text.setPlaceholder("paste token here");
      text.inputEl.type = "password";
      text.inputEl.autocapitalize = "off";
      text.inputEl.autocomplete = "off";
      text.inputEl.spellcheck = false;
      // Enter is rarely available on mobile, but it is convenient on desktop
      text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        void this.saveToken(text.getValue(), text);
      });
    });

    setting.addButton((btn) =>
      btn
        .setButtonText("Save")
        .setCta()
        .onClick(() => {
          if (field) void this.saveToken(field.getValue(), field);
        })
    );

    void this.plugin.tokens.has().then((has) => {
      status.setText(
        has
          ? "A token is saved. It is never displayed again — saving here replaces it."
          : "No token saved yet."
      );
      status.className = has ? "mod-success" : "mod-warning";

      if (has) {
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
      }
    });
  }

  private async saveToken(
    raw: string,
    field?: { setValue(v: string): unknown }
  ): Promise<void> {
    const value = raw.trim();
    if (!value) {
      new Notice("Paste a token first");
      return;
    }
    await this.plugin.tokens.write(value);
    field?.setValue("");
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
