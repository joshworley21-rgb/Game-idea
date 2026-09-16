#!/usr/bin/env python3
"""Write the idle_sit clip into the generated Suit_Male/Suit_Female GLBs.

    python3 scripts/add_sit_animation.py

Why this is not done in Godot: GLTFDocument.append_from_scene() exports the
meshes, the materials and the node hierarchy of a scene, but it exports no
animations at all. That was measured rather than assumed -- a minimal scene of
one Node3D and one AnimationPlayer animating it produces zero glTF animations
on 4.3-stable, 4.4-stable and 4.7.2-stable, under every combination of the
three rotation track types, both animation library names, with and without
GLTFState.create_animations set, detached and inside the scene tree. The clip
has to be written into the file by hand.

So godot/tools/build_suit_models.gd builds the bodies and this writes the
motion. The two run in that order:

    godot --headless --path . --script godot/tools/build_suit_models.gd
    python3 scripts/add_sit_animation.py

The clip is idle_sit, which is the name cabinet_room.gd looks for. Its chain is
idle_sit -> sit -> idle, so this only has to be right once.

The keyframes are the ones the generator authored. They are baked as LINEAR
keys rather than CUBICSPLINE: glTF's linear interpolation between quaternions
is a slerp, and at these amplitudes -- under two degrees -- the difference
between that and a cubic curve is not a thing an eye can find. It also keeps
the file free of the tangent accessors CUBICSPLINE would need.
"""

import json
import math
import struct
import sys
from pathlib import Path

MODELS = Path("public/models")
CLIP = "idle_sit"

# node name -> (channel, [ (time, value), ... ])
#
# Rotations are degrees of local delta from the bind pose, applied after it, so
# a joint that already leans forward keeps leaning and the clip only adds the
# breathing on top. Translations are metres of local offset from the bind.
TRACKS = {
    "Torso": ("rotation", [
        (0.0, (0.0, 0.0, 0.0)),
        (1.2, (-1.3, 0.9, 0.0)),
        (2.4, (0.0, 0.0, 0.0)),
        (3.4, (-0.8, -1.1, 0.0)),
        (4.0, (0.0, 0.0, 0.0)),
    ]),
    "Hips": ("translation", [
        (0.0, (0.0, 0.0, 0.0)),
        (1.6, (0.0, 0.006, 0.0)),
        (3.0, (0.0, -0.003, 0.0)),
        (4.0, (0.0, 0.0, 0.0)),
    ]),
    "Head": ("rotation", [
        (0.0, (0.0, 0.0, 0.0)),
        (1.0, (1.8, 9.0, 0.0)),
        (2.2, (0.4, 4.0, 0.0)),
        (3.2, (-1.6, -7.0, 0.0)),
        (4.0, (0.0, 0.0, 0.0)),
    ]),
}

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
FLOAT = 5126


# ------------------------------------------------------------------ quaternions

def euler_xyz_quat(x_deg, y_deg, z_deg):
    """XYZ intrinsic euler, in radians, as (x, y, z, w)."""
    hx, hy, hz = (math.radians(d) * 0.5 for d in (x_deg, y_deg, z_deg))
    cx, sx = math.cos(hx), math.sin(hx)
    cy, sy = math.cos(hy), math.sin(hy)
    cz, sz = math.cos(hz), math.sin(hz)
    return (
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz + sx * sy * cz,
        cx * cy * cz - sx * sy * sz,
    )


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    )


# -------------------------------------------------------------------- the glb

def read_glb(path):
    raw = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF" or version != 2:
        raise SystemExit("%s is not a glTF 2.0 binary" % path)
    gltf, binary = None, b""
    offset = 12
    while offset < total:
        length, kind = struct.unpack_from("<II", raw, offset)
        body = raw[offset + 8: offset + 8 + length]
        if kind == JSON_CHUNK:
            gltf = json.loads(body.decode("utf-8"))
        elif kind == BIN_CHUNK:
            binary = body
        offset += 8 + length
    if gltf is None:
        raise SystemExit("%s has no JSON chunk" % path)
    return gltf, bytearray(binary)


def write_glb(path, gltf, binary):
    # Chunks are padded to four bytes -- JSON with spaces, BIN with zeros. The
    # reader on the other end trusts these lengths, so both have to be right.
    text = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    blob = bytes(binary)
    blob += b"\x00" * (-len(blob) % 4)
    total = 12 + 8 + len(text) + (8 + len(blob) if blob else 0)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, total)
    out += struct.pack("<II", len(text), JSON_CHUNK) + text
    if blob:
        out += struct.pack("<II", len(blob), BIN_CHUNK) + blob
    path.write_bytes(out)


def append_floats(binary, values):
    """Append a flat float array, and report where it landed and how big."""
    while len(binary) % 4:
        binary.append(0)
    at = len(binary)
    binary += struct.pack("<%df" % len(values), *values)
    return at, len(values) * 4


def add_accessor(gltf, binary, values, kind, count):
    at, size = append_floats(binary, values)
    view = len(gltf.setdefault("bufferViews", []))
    gltf["bufferViews"].append({"buffer": 0, "byteOffset": at, "byteLength": size})
    accessor = len(gltf.setdefault("accessors", []))
    entry = {
        "bufferView": view,
        "componentType": FLOAT,
        "count": count,
        "type": kind,
    }
    if kind == "SCALAR":
        # A sampler's input accessor must carry min and max; validators reject
        # a timing accessor without them, and Godot reads them on import.
        entry["min"] = [min(values)]
        entry["max"] = [max(values)]
    gltf["accessors"].append(entry)
    return accessor


def node_index(gltf, name):
    for i, node in enumerate(gltf.get("nodes", [])):
        if node.get("name") == name:
            return i
    return None


def bind_quat(node):
    r = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    return (r[0], r[1], r[2], r[3])


def build_clip(gltf, binary):
    channels = []
    samplers = []
    missing = []

    for name, (channel, keys) in TRACKS.items():
        index = node_index(gltf, name)
        if index is None:
            missing.append(name)
            continue
        node = gltf["nodes"][index]
        times = [k[0] for k in keys]

        if channel == "rotation":
            base = bind_quat(node)
            values = []
            for _, euler in keys:
                # Bind first, delta second: the clip is layered on the pose the
                # generator set, not a replacement for it.
                final = qmul(base, euler_xyz_quat(*euler))
                values.extend(final)
            kind, count = "VEC4", 4
        else:
            base = node.get("translation", [0.0, 0.0, 0.0])
            values = []
            for _, offset in keys:
                values.extend([base[i] + offset[i] for i in range(3)])
            kind, count = "VEC3", 3

        sampler = len(samplers)
        samplers.append({
            "input": add_accessor(gltf, binary, times, "SCALAR", len(times)),
            "output": add_accessor(gltf, binary, values, kind, len(times)),
            "interpolation": "LINEAR",
        })
        channels.append({
            "sampler": sampler,
            "target": {"node": index, "path": channel},
        })

    if missing:
        # Better to build a clip that is short a joint than to write a file whose
        # animation silently addresses the wrong node.
        print("  warning: no node named %s; skipped" % ", ".join(missing))
    return {"name": CLIP, "channels": channels, "samplers": samplers}


def process(path):
    gltf, binary = read_glb(path)
    gltf.pop("animations", None)
    clip = build_clip(gltf, binary)
    gltf["animations"] = [clip]
    # The buffer length has to match what the accessors now point at, or the
    # file is invalid even though every byte is present.
    gltf["buffers"][0]["byteLength"] = len(binary)
    write_glb(path, gltf, binary)
    joints = len(clip["channels"])
    print("  %-22s %s: %d channels over %d samplers" % (
        path.name, CLIP, joints, len(clip["samplers"])))


def main():
    targets = sorted(MODELS.glob("Suit_*.glb"))
    if not targets:
        raise SystemExit(
            "no Suit_*.glb in %s -- run "
            "godot --headless --path . --script godot/tools/build_suit_models.gd first"
            % MODELS)
    print("adding %s to the suit models" % CLIP)
    for path in targets:
        process(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
