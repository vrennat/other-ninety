#!/opt/homebrew/bin/python3
"""Contact sheets and before/after diffs for screenshots. See SKILL.md.

usage: imgtool.py sheet OUT.png IMG... [--cols N] [--width W]
       imgtool.py diff BEFORE.png AFTER.png OUT.png [--threshold T]
"""
import os, sys
from PIL import Image, ImageChops, ImageDraw


def opt(args, name, default):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return int(v)
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


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('sheet', 'diff'):
        sys.exit(__doc__)
    (sheet if sys.argv[1] == 'sheet' else diff)(sys.argv[2:])
