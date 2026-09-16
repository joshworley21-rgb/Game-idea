#!/usr/bin/env python3
"""
Bulk-generate the 57 character portraits for the Godot build via OpenRouter.

Usage:
    OPENROUTER_API_KEY=sk-or-v1-... python3 scripts/generate_portraits.py

Optional:
    --only cabinet          only build one category (cabinet|family|special)
    --dry-run               list jobs + output paths without calling the API
    --force                 regenerate files that already exist

Output: godot/assets/portraits/{chief,cabinet,family,special}/<name>.webp
"""
import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

try:
    from PIL import Image
    import io as _io
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

WEBP_QUALITY = 88

ENDPOINT = "https://openrouter.ai/api/v1/images"
MODEL = "google/gemini-3.1-flash-image"
RESOLUTION = "512"
ASPECT_RATIO = "1:1"
OUTPUT_FORMAT = "webp"
DELAY_SECONDS = 2.0
MAX_ATTEMPTS = 4

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_ROOT = os.path.join(ROOT, "godot", "assets", "portraits")

CHIEF = [("Ruth Ellery", "ruth-ellery")]
CABINET = [
    "Margaret", "Daniel", "Ruth", "Marcus", "Eleanor", "Priya", "Thomas",
    "Grace", "Andre", "Helen", "Victor", "Naomi", "Charles", "Rosa",
    "Edward", "Fiona", "Malcolm", "Diane", "Samuel", "Yusuf", "Claire",
    "Nathan", "Imani", "Walter",
]
SPOUSES = [
    "Elena", "Marcus", "Nadia", "David", "Priya", "Jonah", "Claire",
    "Samuel", "Rosa", "Michael", "Ines", "Adam", "Leah", "Nicholas",
]
CHILDREN = [
    "Maya", "Theo", "Aisha", "Danny", "Nora", "Elliot", "Sofia", "Caleb",
    "Ruth", "Jonah", "Cleo", "Isaac", "Mara", "Owen", "Nell", "Felix",
]

PROMPT_CHIEF = ("2D stylized political character portrait of a stern Chief "
                "of Staff named Ruth Ellery, wearing a dark suit, dramatic rim "
                "lighting, neutral studio background, video game concept art "
                "style, digital painting")
PROMPT_CABINET = ("2D stylized political character portrait of a politician "
                  "named {name}, wearing a dark suit, dramatic rim lighting, "
                  "neutral studio background, video game concept art style, "
                  "digital painting")
PROMPT_SPOUSE = ("2D stylized character portrait of a political spouse named "
                 "{name}, aged 45 to 60, wearing smart attire, warm natural "
                 "lighting, slate background, video game concept art style, "
                 "digital painting")
PROMPT_CHILD = ("2D stylized character portrait of a politician's child named "
                "{name}, wearing casual streetwear, warm natural lighting, "
                "slate background, video game concept art style, digital "
                "painting")
SPECIALS = [
    ("press", "2D stylized character portrait of a cynical political news "
              "reporter, holding a notepad, video game concept art style"),
    ("ally", "2D stylized character portrait of a foreign Prime Minister, "
             "wearing a diplomatic suit, video game concept art style"),
]


def slugify(value):
    value = re.sub(r"[^a-z0-9]+", "-", value.lower().strip())
    return value.strip("-")


def build_jobs():
    """Return an ordered list of (category, out_dir, filename, prompt)."""
    jobs = []
    for name, slug in CHIEF:
        jobs.append(("chief", "chief", slug, PROMPT_CHIEF))
    for name in CABINET:
        jobs.append(("cabinet", "cabinet", slugify(name),
                     PROMPT_CABINET.format(name=name)))
    for name in SPOUSES:
        jobs.append(("family", "family", slugify(name),
                     PROMPT_SPOUSE.format(name=name)))
    for name in CHILDREN:
        # 'family' holds both spouses and children; Jonah appears in both,
        # so a later duplicate gets a '-child' suffix instead of overwriting.
        jobs.append(("family", "family", slugify(name),
                     PROMPT_CHILD.format(name=name)))
    for role, prompt in SPECIALS:
        jobs.append(("special", "special", slugify(role), prompt))

    # Resolve filename collisions deterministically (first job keeps the plain
    # name, later duplicates get a qualifier).
    used = {}
    resolved = []
    for category, out_dir, base, prompt in jobs:
        key = (out_dir, base)
        if key in used:
            used[key] += 1
            base = "{}-{}".format(base, category if category != "family"
                                  else "child")
            while (out_dir, base) in used:
                base = base + "x"
        used[(out_dir, base)] = 1
        resolved.append((category, out_dir, base, prompt))
    return resolved


def post_image(api_key, prompt):
    """POST one generation request. Returns raw image bytes."""
    payload = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "resolution": RESOLUTION,
        "aspect_ratio": ASPECT_RATIO,
        "output_format": OUTPUT_FORMAT,
        "n": 1,
    }).encode("utf-8")

    req = urllib.request.Request(ENDPOINT, data=payload, method="POST")
    req.add_header("Authorization", "Bearer {}".format(api_key))
    req.add_header("Content-Type", "application/json")
    req.add_header("HTTP-Referer", "https://github.com/joshworley21-rgb/Game-idea")
    req.add_header("X-Title", "President Simulator Portraits")

    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    data = body.get("data") or []
    if not data:
        raise RuntimeError("no image data in response: {}".format(
            json.dumps(body)[:400]))

    first = data[0]
    b64 = first.get("b64_json")
    if not b64:
        raise RuntimeError("response had no b64_json (keys: {})".format(
            list(first.keys())))

    return base64.b64decode(b64)


def to_webp(raw):
    """OpenRouter ignores output_format and returns PNG; transcode to WebP.

    Returns (bytes, note). Falls back to the original bytes if Pillow is
    unavailable so a missing converter never costs us a finished image.
    """
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return raw, None
    if not HAVE_PIL:
        return raw, "Pillow unavailable - saved as returned"
    image = Image.open(_io.BytesIO(raw)).convert("RGB")
    buffer = _io.BytesIO()
    image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=6)
    return buffer.getvalue(), None


def describe_error(exc):
    if isinstance(exc, urllib.error.HTTPError):
        try:
            detail = exc.read().decode("utf-8")[:400]
        except Exception:
            detail = "<unreadable>"
        return "HTTP {} {}".format(exc.code, detail)
    return str(exc)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only",
                        choices=["chief", "cabinet", "family", "special"])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    jobs = build_jobs()
    if args.only:
        jobs = [j for j in jobs if j[0] == args.only]

    if args.dry_run:
        print("{} jobs:".format(len(jobs)))
        for category, out_dir, base, prompt in jobs:
            rel = os.path.join("godot/assets/portraits", out_dir,
                               base + "." + OUTPUT_FORMAT)
            print("  [{}] {}\n      {}".format(category, rel, prompt[:88]))
        return 0

    api_key = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        print("Missing OPENROUTER_API_KEY.", file=sys.stderr)
        return 1

    for sub in ("chief", "cabinet", "family", "special"):
        os.makedirs(os.path.join(OUT_ROOT, sub), exist_ok=True)

    print("Generating {} portraits with {}\n".format(len(jobs), MODEL))
    manifest = {}
    ok, skipped, failed = [], [], []

    for index, (category, out_dir, base, prompt) in enumerate(jobs, 1):
        path = os.path.join(OUT_ROOT, out_dir,
                            base + "." + OUTPUT_FORMAT)
        tag = "[{:2d}/{}]".format(index, len(jobs))
        rel = os.path.relpath(path, ROOT)

        if os.path.exists(path) and not args.force:
            print("{} skip     {} (exists)".format(tag, rel))
            skipped.append(rel)
            manifest[category + "/" + base] = rel
            continue

        print("{} generate {}".format(tag, rel))
        raw, error = None, None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                raw = post_image(api_key, prompt)
                error = None
                break
            except Exception as exc:  # noqa: BLE001 - report and retry
                error = exc
                raw = None
                message = describe_error(exc)
                if attempt == MAX_ATTEMPTS:
                    break
                wait = DELAY_SECONDS * (2 ** attempt)
                print("      attempt {}/{} failed: {} - retrying in {:.0f}s"
                      .format(attempt, MAX_ATTEMPTS, message[:160], wait))
                time.sleep(wait)

        if raw is None:
            detail = describe_error(error) if error else "unknown error"
            failed.append((rel, detail))
            print("      FAILED: {}".format(detail[:200]))
        else:
            encoded, note = to_webp(raw)
            if note:
                print("      note: {}".format(note))
            with open(path, "wb") as handle:
                handle.write(encoded)
            print("      saved {:.1f} KB (from {:.1f} KB PNG)"
                  .format(len(encoded) / 1024.0, len(raw) / 1024.0))
            ok.append(rel)
            manifest[category + "/" + base] = rel

        time.sleep(DELAY_SECONDS)

    manifest_path = os.path.join(OUT_ROOT, "manifest.json")
    with open(manifest_path, "w") as handle:
        json.dump(manifest, handle, indent=2, sort_keys=True)
        handle.write("\n")

    print("\n=== summary ===")
    print("generated: {}".format(len(ok)))
    print("skipped:   {}".format(len(skipped)))
    print("failed:    {}".format(len(failed)))
    for rel, err in failed:
        print("  FAILED {} - {}".format(rel, err[:160]))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
