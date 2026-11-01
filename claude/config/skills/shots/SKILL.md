---
name: shots
description: Take screenshots of one or more URLs at several viewport sizes in one call, and build labeled contact sheets or before/after pixel diffs from PNGs. Use for responsive or visual QA sweeps instead of driving the Playwright MCP page by page, and instead of writing PIL code by hand.
license: MIT
---

# shots

Two scripts in this directory. Both run from any working directory.

## Viewport sweep

```sh
~/.claude/skills/shots/shots.sh [--out DIR] [--sizes 390x844,768x1024,1440x900] [--full] [--wait SELECTOR] [--dark] [--storage STATE.json] URL...
```

- Writes `DIR/<slug>-<W>x<H>.png` per URL and size (default DIR is `./shots`) and prints each path.
- `--full` captures the whole scrollable page. `--wait` waits for a selector first. `--storage` loads a Playwright storage-state file for logged-in pages.
- It uses the current repo's `node_modules/.bin/playwright` when there is one, else `$SHOTS_PLAYWRIGHT`, else `bunx playwright@1.61.1` (the version whose Chromium is in `~/Library/Caches/ms-playwright`). The bunx path downloads on first use; if it hangs, point `SHOTS_PLAYWRIGHT` at any installed Playwright CLI.

## Contact sheet, diff and blank check

```sh
~/.claude/skills/shots/imgtool.py sheet OUT.png IMG... [--cols 3] [--width 480]
~/.claude/skills/shots/imgtool.py diff BEFORE.png AFTER.png OUT.png [--threshold 16]
~/.claude/skills/shots/imgtool.py stats IMG... [--max-dominant 0.9] [--min-contrast 10]
```

- `sheet` tiles images with their file names as labels, scaled to a common column width.
- `diff` writes before, after, and a red change mask side by side, and prints the changed-pixel percentage and bounding box. Images of different sizes are compared on the overlapping area and the size change is printed.
- `stats` prints, per image, the dominant-colour share, colour entropy, luminance contrast (p95 − p5) and edge density. It marks an image `LOW-VARIANCE` and exits 1 when one colour covers more than `--max-dominant` of it or contrast is under `--min-contrast`. That catches white-outs, black screens and stuck loaders before anyone looks at the picture. A pass only means something rendered: still read the image. Low numbers on a deliberately sparse design need an explanation, not more clutter.
- Runs through `uv run --script`, which fetches Pillow on first use, so it does not depend on which Python is the default.

Read the resulting PNG with the Read tool to look at it.
