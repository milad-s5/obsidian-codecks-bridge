import { App, Modal } from "obsidian";

/**
 * Renaming a space.
 *
 * A modal rather than window.prompt: this panel is used on a phone, where a
 * prompt is either suppressed or unusable.
 */
export class RenameModal extends Modal {
  private value: string;

  constructor(
    app: App,
    private opts: {
      /** What the row shows now, custom name or generated one */
      current: string;
      /** What it falls back to when the custom name is cleared */
      fallback: string;
      onSave: (name: string) => void;
    }
  ) {
    super(app);
    this.value = opts.current;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cdx-rename");

    contentEl.createEl("h3", { text: "Rename space" });
    contentEl.createEl("p", {
      cls: "cdx-rename-note",
      text:
        "Codecks does not expose a name for this section, so the name lives in " +
        "this plugin's settings. Leave it empty to go back to " +
        `“${this.opts.fallback}”.`,
    });

    const input = contentEl.createEl("input", { type: "text", cls: "cdx-rename-input" });
    input.value = this.value;
    input.placeholder = this.opts.fallback;
    input.addEventListener("input", () => (this.value = input.value));
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      this.save();
    });

    const row = contentEl.createDiv({ cls: "cdx-rename-btns" });
    const cancel = row.createEl("button", { cls: "cdx-btn", text: "Cancel" });
    cancel.addEventListener("click", () => this.close());

    const save = row.createEl("button", { cls: "cdx-btn cdx-btn-cta", text: "Save" });
    save.addEventListener("click", () => this.save());

    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  private save(): void {
    this.close();
    this.opts.onSave(this.value.trim());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
