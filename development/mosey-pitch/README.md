# Mosey — pitch page

Working files for **Mosey**, a walking-companion app (silent hand-drawn dog + deadpan typewriter narrator). Lives inside the website repo as an unlinked page — not in any nav, but live at **natanmoura.com/development/mosey-pitch/** once pushed.

## Files

- **`mosey-bible.md`** — the full product & design bible (8 sections + locked-canon appendix). The source of truth. Everything else derives from this.
- **`index.html`** — the visual bible: an interactive, self-contained presentation of the concept with mockups of the MVP screens and live typewriter animation.
- **`assets/`** — real hand-drawn Mosey artwork (PNG), used throughout `index.html`.

## Running locally

This folder is part of the main website, so it's served by the site's own dev server — no standalone server needed. From the website root:

```
python -m http.server 3000
```

then visit `http://localhost:3000/development/mosey-pitch/`.

## About the visual bible (index.html)

Design choice: the page presents itself *as the document the app is* — ink on cream, typewriter type, a red-flag accent. It demonstrates the brand rather than describing it.

- **Fonts (placeholders, via Google Fonts):** Courier Prime stands in for iA Writer Mono (the narrator); Caveat stands in for the handwritten letter hands; Fraunces for display. Swap Courier Prime → iA Writer Mono for production.
- **Character art:** real hand-drawn Mosey artwork in `assets/`, composited into the mockups via CSS `mix-blend-mode:multiply` so each PNG's white background dissolves into the page's cream tone.
- **Narrator text types itself in** on scroll (afterthought beats + visible strikethrough, no blinking cursor — per canon), left-justified, top-anchored so it never shifts surrounding layout as it fills in.
- Single fixed palette (Ember) — no palette switcher.

## Open decisions (see bible §1.2, §8)

- Name: **Mosey** vs. "Mozy" respelling — recommendation is Mosey. Trademark + handle search still needed (both spellings).
- Next companion doc: a screens & flows spec (every surface, every transition).

## Voice

All Mosey copy — narrator, letters, marketing — should go through the **`mosey-voice`** skill, which encodes the house style, the per-resident letter voices, and the document register.

## Publishing

This is a working page, not committed/pushed automatically by any tool — review with `git status` / `git diff` inside `development/mosey-pitch/` and commit + push from the website repo when ready to make an update live.
