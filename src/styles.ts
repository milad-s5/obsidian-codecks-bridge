export const STYLES = `
.cdx-root { display: flex; flex-direction: column; height: 100%; padding: 0; }

.cdx-toolbar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 10px 14px; flex-shrink: 0;
  background: var(--background-secondary);
  border-bottom: 1px solid var(--background-modifier-border);
}
.cdx-spacer { flex: 1; }

.cdx-btn {
  padding: 4px 10px; font-size: 12px; border-radius: 6px; cursor: pointer;
  background: var(--background-primary); color: var(--text-muted);
  border: 1px solid var(--background-modifier-border);
}
.cdx-btn:hover:not(:disabled) { color: var(--text-normal); background: var(--background-modifier-hover); }
.cdx-btn:disabled { opacity: 0.45; cursor: default; }
.cdx-btn-cta:not(:disabled) {
  background: var(--interactive-accent); color: var(--text-on-accent);
  border-color: var(--interactive-accent); font-weight: 600;
}

.cdx-select, .cdx-search {
  padding: 4px 8px; font-size: 12px; border-radius: 6px;
  background: var(--background-primary); color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
}
.cdx-search { min-width: 160px; flex: 1 1 160px; }

.cdx-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-muted); cursor: pointer; white-space: nowrap;
}

.cdx-counts {
  padding: 7px 14px; font-size: 11.5px; color: var(--text-faint);
  border-bottom: 1px solid var(--background-modifier-border); flex-shrink: 0;
}

.cdx-list { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 10px 20px; }

.cdx-card {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 10px; margin-bottom: 6px; border-radius: 8px;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
}
.cdx-card.imported { opacity: 0.6; }
.cdx-check { margin-top: 3px; flex-shrink: 0; }
.cdx-card-main { flex: 1; min-width: 0; }

.cdx-card-title-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.cdx-card-title { font-size: 13px; font-weight: 500; color: var(--text-normal); }
.cdx-card-meta { margin-top: 3px; font-size: 11px; color: var(--text-faint); }

.cdx-tag {
  font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em;
  padding: 1px 5px; border-radius: 4px; color: var(--text-faint);
  border: 1px solid var(--background-modifier-border); flex-shrink: 0;
}
.cdx-tag-ok { color: var(--color-green); border-color: var(--color-green); }

.cdx-link { flex-shrink: 0; color: var(--text-faint); text-decoration: none; padding: 0 2px; }
.cdx-link:hover { color: var(--text-accent); }

.cdx-empty, .cdx-error { padding: 26px 18px; text-align: center; font-size: 13px; }
.cdx-empty { color: var(--text-faint); }
.cdx-error { color: var(--color-red); }
`;
