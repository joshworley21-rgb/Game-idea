#!/usr/bin/env python3
"""Remove the background from every portrait under godot/assets/portraits/.

Uses rembg with the u2netp model (ultra-lightweight, ~4.7MB) so the whole batch
fits comfortably in memory on a phone -- birefnet-general needs ~973MB and was
getting OOM-killed.

Output is RGBA WebP (alpha preserved), written back over the original .webp so
that manifest.json and PORTRAITS.md keep working unchanged. Each file is written
to a temp path and atomically renamed into place, so an interrupted run never
leaves a half-written portrait behind. Already-transparent files are skipped,
which makes the script resumable: just run it again.
"""

import argparse
import os
import sys
import time
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "godot" / "assets" / "portraits"
MODEL = os.environ.get("REMBG_MODEL", "u2netp")
QUALITY = int(os.environ.get("WEBP_QUALITY", "92"))

# A portrait counts as "already done" if at least this fraction of its pixels is
# fully transparent -- i.e. a background mask has clearly been applied.
TRANSPARENT_ENOUGH = 0.02


def collect():
    return sorted(p for p in SRC.rglob("*.webp") if p.is_file())


def has_alpha(p):
    """True if the image already carries a removed background."""
    try:
        with Image.open(p) as im:
            if im.mode not in ("RGBA", "LA", "PA"):
                return False
            alpha = im.convert("RGBA").getchannel("A")
            hist = alpha.histogram()
            total = sum(hist)
            if not total:
                return False
            return (hist[0] / float(total)) >= TRANSPARENT_ENOUGH
    except Exception:
        return False


def parse_args():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="process at most N portraits this run, then exit (0 = all). "
        "Finished files are kept, so the next run resumes where this one stopped.",
    )
    ap.add_argument(
        "--reset",
        action="store_true",
        help="reprocess every portrait, including ones already done.",
    )
    return ap.parse_args()


def main():
    args = parse_args()

    all_files = collect()
    if not all_files:
        sys.exit("no .webp portraits found under %s" % SRC)

    if args.reset:
        todo = list(all_files)
    else:
        todo = [f for f in all_files if not has_alpha(f)]

    print(
        "found %d portraits (%d already done, %d to do)"
        % (len(all_files), len(all_files) - len(todo), len(todo)),
        flush=True,
    )
    if not todo:
        print("nothing left to process", flush=True)
        return

    batch = todo[: args.limit] if args.limit else todo

    print("loading model %r..." % MODEL, flush=True)
    session = new_session(MODEL)
    print("model ready -- %d image(s) this run" % len(batch), flush=True)

    ok = 0
    failures = []
    started = time.time()

    for i, src in enumerate(batch, 1):
        rel = src.relative_to(SRC)
        t0 = time.time()
        dst_tmp = src.with_name(src.name + ".tmp")
        try:
            with Image.open(src) as im:
                im = im.convert("RGBA")
                out = remove(im, session=session, post_process_mask=True)
            out = out.convert("RGBA")

            alpha = out.getchannel("A")
            hist = alpha.histogram()
            total = sum(hist)
            transparent = hist[0] / float(total) if total else 0.0
            if transparent < 0.001:
                raise ValueError("alpha is untouched (no background removed)")
            if transparent > 0.98:
                raise ValueError("image is fully transparent (subject lost)")

            out.save(dst_tmp, "WEBP", quality=QUALITY, method=4)
            os.replace(dst_tmp, src)
            ok += 1
            print(
                "[%2d/%d] %-32s ok  %5.1f%% cut  %6.1fKB  %4.1fs"
                % (
                    i,
                    len(batch),
                    str(rel),
                    transparent * 100,
                    src.stat().st_size / 1024,
                    time.time() - t0,
                ),
                flush=True,
            )
        except Exception as exc:
            if dst_tmp.exists():
                dst_tmp.unlink()
            failures.append((str(rel), repr(exc)))
            print("[%2d/%d] %-32s FAILED: %s" % (i, len(batch), str(rel), exc), flush=True)

    elapsed = time.time() - started
    print("\n%d ok, %d failed in %.1fs" % (ok, len(failures), elapsed), flush=True)

    if failures:
        print("\nfailures:", flush=True)
        for rel, err in failures:
            print("  %s: %s" % (rel, err), flush=True)

    if args.limit and len(todo) > len(batch):
        print("\n%d still to process -- run again to continue" % (len(todo) - len(batch)), flush=True)

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
