#!/usr/bin/env python3
"""Build PORTRAITS.md — a browsable gallery of every generated portrait.

Reads godot/assets/portraits/manifest.json and writes a Markdown document with
one image grid per category, so the portraits can be reviewed without opening
each file or launching the game.

Usage:  python3 scripts/make_portrait_doc.py
"""

import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "godot", "assets", "portraits")
MANIFEST = os.path.join(ASSETS, "manifest.json")
OUT = os.path.join(ROOT, "PORTRAITS.md")

COLUMNS = 4
THUMB_WIDTH = 150

# The family folder holds spouses and children together; split them back out so
# the document reads in the same order as the brief the art was generated from.
SPOUSES = [
    "elena", "marcus", "nadia", "david", "priya", "jonah", "claire",
    "samuel", "rosa", "michael", "ines", "adam", "leah", "nicholas",
]
CHILDREN = [
    "maya", "theo", "aisha", "danny", "nora", "elliot", "sofia", "caleb",
    "ruth", "jonah-child", "cleo", "isaac", "mara", "owen", "nell", "felix",
]

SPECIAL_LABELS = {
    "press": "Press — cynical news reporter",
    "ally": "Ally — foreign Prime Minister",
}


def display_name(slug):
    """'ruth-ellery' -> 'Ruth Ellery'; 'jonah-child' -> 'Jonah (child)'."""
    if slug == "jonah-child":
        return "Jonah (child)"
    return " ".join(word.capitalize() for word in slug.split("-"))


def read_manifest():
    with open(MANIFEST, encoding="utf-8") as handle:
        return json.load(handle)


def describe(path):
    """Return (width, height, size_kb) for a portrait, or None if unreadable."""
    if not os.path.exists(path):
        return None
    with Image.open(path) as img:
        width, height = img.size
    return width, height, os.path.getsize(path) / 1024.0


def grid(entries):
    """Render a Markdown table of thumbnails, COLUMNS per row."""
    lines = []
    for start in range(0, len(entries), COLUMNS):
        row = entries[start:start + COLUMNS]
        cells = []
        for rel, caption in row:
            cells.append(
                '<img src="%s" width="%d" alt="%s"><br><sub>%s</sub>'
                % (rel, THUMB_WIDTH, caption, caption)
            )
        # Pad the final row so the table keeps its shape.
        cells += [""] * (COLUMNS - len(cells))
        lines.append("| " + " | ".join(cells) + " |")
    return lines


def build():
    manifest = read_manifest()
    missing = []
    total_bytes = 0
    dimensions = set()

    def collect(keys):
        nonlocal total_bytes
        out = []
        for key in keys:
            rel = manifest.get(key)
            if rel is None:
                missing.append(key)
                continue
            info = describe(os.path.join(ROOT, rel))
            if info is None:
                missing.append(key)
                continue
            width, height, kb = info
            dimensions.add((width, height))
            total_bytes += kb * 1024
            slug = key.split("/")[-1]
            caption = SPECIAL_LABELS.get(slug, display_name(slug))
            out.append((rel, caption))
        return out

    chief = collect([k for k in manifest if k.startswith("chief/")])
    cabinet = collect(sorted(k for k in manifest if k.startswith("cabinet/")))
    spouses = collect(["family/" + s for s in SPOUSES])
    children = collect(["family/" + c for c in CHILDREN])
    specials = collect(sorted(k for k in manifest if k.startswith("special/")))

    counted = len(chief) + len(cabinet) + len(spouses) + len(children) + len(specials)
    sized = ", ".join("%d×%d" % d for d in sorted(dimensions)) or "unknown"

    doc = []
    doc.append("# Portraits")
    doc.append("")
    doc.append(
        "Every character portrait in the game, generated with "
        "`google/gemini-3.1-flash-image` and stored as WebP in "
        "`godot/assets/portraits/`."
    )
    doc.append("")
    doc.append("| | |")
    doc.append("|---|---|")
    doc.append("| **Total** | %d portraits |" % counted)
    doc.append("| **Size** | %s, %.1f MB on disk |"
               % (sized, total_bytes / (1024 * 1024)))
    doc.append("| **Lookup** | `godot/assets/portraits/manifest.json` |")
    doc.append("")
    doc.append("Portraits are named by slug, not by role, so a name that can "
               "appear in more than one role (`Marcus` in both the cabinet and "
               "as a spouse, `Ruth` as both Chief of Staff and a child) resolves "
               "to its own file.")
    doc.append("")

    sections = [
        ("The Chief of Staff", chief),
        ("The Cabinet", cabinet),
        ("The Spouses", spouses),
        ("The Children", children),
        ("The Specials", specials),
    ]
    for title, entries in sections:
        doc.append("## %s (%d)" % (title, len(entries)))
        doc.append("")
        if not entries:
            doc.append("_No portraits generated yet._")
            doc.append("")
            continue
        header = "| " + " | ".join([" "] * COLUMNS) + " |"
        divider = "| " + " | ".join(["---"] * COLUMNS) + " |"
        doc.append(header)
        doc.append(divider)
        doc.extend(grid(entries))
        doc.append("")

    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("\n".join(doc).rstrip() + "\n")

    print("wrote %s" % os.path.relpath(OUT, ROOT))
    print("  counts: chief=%d cabinet=%d spouses=%d children=%d specials=%d"
          % (len(chief), len(cabinet), len(spouses), len(children), len(specials)))
    print("  dimensions: %s" % sized)
    if missing:
        print("  MISSING (%d): %s" % (len(missing), ", ".join(missing)))
    else:
        print("  all %d manifest entries resolved" % counted)


if __name__ == "__main__":
    build()
