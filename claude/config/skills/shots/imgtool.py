#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=11"]
# ///
"""Contact sheets, before/after diffs and blank-frame checks for screenshots. See SKILL.md.

usage: imgtool.py sheet OUT.png IMG... [--cols N] [--width W]
       imgtool.py diff BEFORE.png AFTER.png OUT.png [--threshold T]
       imgtool.py stats IMG... [--max-dominant F] [--min-contrast C]
"""
import math, os, sys
from PIL import Image, ImageChops, ImageDraw


def opt(args, name, default, kind=int):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return kind(v)
    return default


def sheet(args):
    cols = opt(args, '--cols', 3); width = opt(args, '--width', 480)
    out, paths = args[0], args[1:]
    if not paths:
        sys.exit('sheet: no images')
    tiles = []
    for p in paths:
        im = Image.open(p).convert('RGB')
        im = im.resize((width, max(1, round(im.height * width / im.width))))
        tiles.append((os.path.basename(p), im))
    label, pad = 22, 8
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    heights = [max(t[1].height for t in r) + label + pad for r in rows]
    canvas = Image.new('RGB', (cols * (width + pad) + pad, sum(heights) + pad), 'white')
    draw = ImageDraw.Draw(canvas); y = pad
    for r, h in zip(rows, heights):
        for c, (name, im) in enumerate(r):
            x = pad + c * (width + pad)
            draw.text((x, y + 4), name, fill='black')
            canvas.paste(im, (x, y + label))
        y += h
    canvas.save(out); print(f'{out}: {len(tiles)} images, {canvas.width}x{canvas.height}')


def diff(args):
    threshold = opt(args, '--threshold', 16)
    a, b = Image.open(args[0]).convert('RGB'), Image.open(args[1]).convert('RGB')
    out = args[2]
    w, h = min(a.width, b.width), min(a.height, b.height)
    if a.size != b.size:
        print(f'size changed: {a.width}x{a.height} -> {b.width}x{b.height}; comparing the {w}x{h} overlap')
    ca, cb = a.crop((0, 0, w, h)), b.crop((0, 0, w, h))
    mask = ImageChops.difference(ca, cb).convert('L').point(lambda v: 255 if v > threshold else 0)
    changed = mask.histogram()[255]
    box = mask.getbbox()
    overlay = cb.copy(); overlay.paste(Image.new('RGB', (w, h), (255, 0, 0)), (0, 0), mask)
    canvas = Image.new('RGB', (a.width + b.width + w + 16, max(a.height, b.height, h)), 'white')
    canvas.paste(a, (0, 0)); canvas.paste(b, (a.width + 8, 0)); canvas.paste(overlay, (a.width + b.width + 16, 0))
    canvas.save(out)
    print(f'{out}: {100 * changed / (w * h):.2f}% of pixels changed, bbox {box}')


def measure(path):
    """Pixel signals for one image. A blank, white-out or black frame has one dominant colour and no contrast."""
    im = Image.open(path).convert('RGB')
    im.thumbnail((256, 256))  # the signals are coarse; a small copy keeps this fast on 4K captures
    n = im.width * im.height
    # 16 levels per channel, so antialiasing and gradients don't count as distinct colours.
    counts = Image.eval(im, lambda v: v >> 4 << 4).getcolors(n)
    dominant = max(c for c, _ in counts) / n
    entropy = 0.0 - sum(c / n * math.log2(c / n) for c, _ in counts)
    lum = im.convert('L')
    hist, seen, p5, p95 = lum.histogram(), 0, None, 255
    for v, c in enumerate(hist):
        seen += c
        if p5 is None and seen >= 0.05 * n:
            p5 = v
        if seen >= 0.95 * n:
            p95 = v; break
    # Share of pixels whose luminance differs by more than 12 from the right or lower neighbour.
    right = ImageChops.difference(lum.crop((0, 0, lum.width - 1, lum.height)), lum.crop((1, 0, lum.width, lum.height)))
    down = ImageChops.difference(lum.crop((0, 0, lum.width, lum.height - 1)), lum.crop((0, 1, lum.width, lum.height)))
    edges = ImageChops.lighter(right.crop((0, 0, right.width, down.height)), down.crop((0, 0, right.width, down.height)))
    edge_density = sum(edges.point(lambda v: 1 if v > 12 else 0).histogram()[1:]) / max(1, edges.width * edges.height)
    return {'dominant': dominant, 'entropy': entropy, 'contrast': p95 - p5, 'edges': edge_density}


def stats(args):
    max_dominant = opt(args, '--max-dominant', 0.9, float)
    min_contrast = opt(args, '--min-contrast', 10, float)
    if not args:
        sys.exit('stats: no images')
    flagged = 0
    for p in args:
        m = measure(p)
        blank = m['dominant'] > max_dominant or m['contrast'] < min_contrast
        flagged += blank
        print(f"{p}: {'LOW-VARIANCE' if blank else 'ok'} dominant={m['dominant']:.3f} "
              f"entropy={m['entropy']:.2f}bits contrast={m['contrast']} edges={m['edges']:.3f}")
    sys.exit(1 if flagged else 0)


if __name__ == '__main__':
    commands = {'sheet': sheet, 'diff': diff, 'stats': stats}
    if len(sys.argv) < 3 or sys.argv[1] not in commands:
        sys.exit(__doc__)
    commands[sys.argv[1]](sys.argv[2:])
