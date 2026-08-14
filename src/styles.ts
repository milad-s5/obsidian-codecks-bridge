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

.cdx-ws { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; }
.cdx-ws-label { font-size: 11px; color: var(--text-faint); }
.cdx-warn { font-size: 11.5px; color: var(--color-orange, var(--text-muted)); }

.cdx-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-muted); cursor: pointer; white-space: nowrap;
}

.cdx-counts {
  padding: 7px 14px; font-size: 11.5px; color: var(--text-faint);
  border-bottom: 1px solid var(--background-modifier-border); flex-shrink: 0;
}

.cdx-list { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 10px 20px; }

/* ── Space header ─────────────────────────────────────────────────────── */
.cdx-space-head {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 6px 8px; cursor: pointer; user-select: none;
  position: sticky; top: 0; z-index: 3;
  background: var(--background-primary);
}
.cdx-space-head:hover .cdx-space-name { color: var(--text-accent); }
.cdx-caret { font-size: 10px; color: var(--text-faint); width: 10px; flex-shrink: 0; }
.cdx-space-name {
  font-size: 16px; font-weight: 800; color: var(--text-normal);
  letter-spacing: -0.01em;
}

/* ── Deck grid ────────────────────────────────────────────────────────── */
.cdx-deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
  padding: 4px 6px 12px;
}

.cdx-deck {
  position: relative;
  aspect-ratio: 3 / 3.5;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  display: flex; flex-direction: column;
  background: var(--background-secondary);
  /* The ring in the deck's own colour is what makes a Codecks board readable
     from across the room, so it is the strongest thing on the card. */
  box-shadow: 0 0 0 2px var(--deck), 0 2px 6px rgba(0, 0, 0, 0.25);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.cdx-deck:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 0 2px var(--deck), 0 6px 14px rgba(0, 0, 0, 0.35);
}
.cdx-deck:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
.cdx-deck.is-open {
  box-shadow: 0 0 0 3px var(--deck), 0 0 0 6px color-mix(in srgb, var(--deck) 30%, transparent);
}

/* Codecks decks read as bright, colourful tiles. Fading the cover out to the
   page background made them muddy, so it stays in the deck's own colour and
   only lightens towards the top. */
.cdx-deck-cover {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  background:
    linear-gradient(
      165deg,
      color-mix(in srgb, var(--deck) 68%, #ffffff) 0%,
      color-mix(in srgb, var(--deck) 88%, #000000) 100%
    );
}
.cdx-deck-glyph {
  font-size: 27px; font-weight: 800; letter-spacing: 0.04em;
  color: #fff; opacity: 0.55;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
}

.cdx-deck-band {
  flex: 0 0 38%;
  background: var(--deck);
  display: flex; align-items: center; justify-content: center;
  padding: 4px 8px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}
.cdx-deck-title {
  font-size: 12px; font-weight: 700; color: #fff; text-align: center;
  line-height: 1.25; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Counts sit on the band's lower edge, as they do in the app */
.cdx-deck-badges {
  position: absolute; left: 0; right: 0; bottom: 5px;
  display: flex; align-items: center; justify-content: center; gap: 3px;
}
.cdx-badge {
  min-width: 17px; height: 17px; padding: 0 4px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; border-radius: 4px;
  font-variant-numeric: tabular-nums;
  background: #f2f2f2; color: #333;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
.cdx-badge.is-done { background: #4caf50; color: #fff; }
.cdx-badge.is-sel { background: var(--interactive-accent); color: var(--text-on-accent); }

.cdx-deck-pick {
  position: absolute; top: 5px; right: 5px;
  width: 20px; height: 20px; padding: 0; line-height: 1;
  border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 700;
  background: rgba(0, 0, 0, 0.4); color: #fff; border: none;
  opacity: 0; transition: opacity 0.12s ease;
}
.cdx-deck:hover .cdx-deck-pick, .cdx-deck-pick:focus-visible { opacity: 1; }
.cdx-deck-pick:hover { background: var(--deck); }

/* ── The open deck's cards ────────────────────────────────────────────── */
.cdx-deck-panel {
  margin: 0 6px 14px;
  padding: 10px 10px 6px;
  border-radius: 10px;
  background: var(--background-secondary);
  border-left: 3px solid var(--deck);
}
.cdx-panel-head {
  display: flex; align-items: center; gap: 7px; margin-bottom: 8px;
}
.cdx-panel-dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--deck); flex-shrink: 0;
}
.cdx-panel-title { font-size: 12.5px; font-weight: 700; color: var(--text-normal); }

.cdx-group-count {
  font-size: 10px; color: var(--text-faint);
  background: var(--background-modifier-border);
  border-radius: 999px; padding: 0 6px; flex-shrink: 0;
}
.cdx-mini {
  margin-inline-start: auto; flex-shrink: 0;
  font-size: 10px; padding: 1px 7px; border-radius: 5px; cursor: pointer;
  background: transparent; color: var(--text-faint);
  border: 1px solid var(--background-modifier-border);
}
.cdx-mini:hover { color: var(--text-normal); background: var(--background-modifier-hover); }

.cdx-card {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 10px; margin: 0 0 5px; border-radius: 8px;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
}
.cdx-card:hover { border-color: color-mix(in srgb, var(--deck) 55%, var(--background-modifier-border)); }
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

.cdx-seq {
  flex-shrink: 0; font-size: 10.5px; color: var(--text-faint);
  font-variant-numeric: tabular-nums; padding-top: 2px;
}

.cdx-empty, .cdx-error { padding: 26px 18px; text-align: center; font-size: 13px; }
.cdx-empty { color: var(--text-faint); }
.cdx-error { color: var(--color-red); }
`;
