/**
 * Converts the Conference Room source pack into the Cabinet Room's props.
 *
 *     node scripts/convert-conference-room.mjs <source dir or .zip> [--out public/models]
 *
 * The pack is an Unreal Engine 4 project supplied by the project owner, and it
 * arrives twice over: once as a `.uproject` full of `.uasset` files, which
 * nothing but Unreal can open, and once as "Conference Room Source Files" —
 * 22 FBX meshes and 43 textures. This reads the second one. The first is not
 * needed and cannot be used: `.uasset` is Unreal's own binary format, and the
 * room's *layout* is the one thing that only exists in there, in a `.umap`.
 *
 * So the layout is not converted, it is authored: this writes each piece as its
 * own `CR_*.glb` and `godot/scenes/cabinet_room.tscn` places them. That is the
 * same shape the briefing room's `BR_*` props take, and it is the right one
 * here — the pieces are each modelled around their own origin rather than at
 * their position in the room, so there is nothing to recover by merging them
 * into a single file.
 *
 * Three things about the source are worth knowing before changing any of this.
 *
 *   The meshes are already in metres. An FBX out of Unreal is usually in
 *   centimetres and needs scaling by 0.01; these do not. The floor measures
 *   12.00 x 8.00 and the table 6.65 x 1.90, which is a real room at real size,
 *   so nothing here touches scale.
 *
 *   The textures are TGA, which neither glTF nor sharp will read. They are
 *   uncompressed, though, so `readTga` below decodes them directly rather than
 *   adding a dependency. Two flavours appear: type 2 true-colour (24-bit BGR or
 *   32-bit BGRA) and type 1 colour-mapped 8-bit, which is how the greyscale
 *   roughness and metallic maps are stored. Both may be bottom-up, which bit 5
 *   of the descriptor says.
 *
 *   glTF wants roughness and metallic in one image — green for roughness, blue
 *   for metallic — where the pack has them as two greyscale files. `packOrm`
 *   below does that join.
 *
 * What is not converted: the `.psd` files (the picture art, the journal covers
 * and one ambient-occlusion map), because nothing here reads Photoshop
 * documents, and `Light_Blocking`, which is a lightmass shell — a black box
 * around the whole room that exists to stop Unreal's baker leaking light, and
 * which in Godot would simply hide the room inside it.
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { godotReady } from "./godot-ready.mjs";

const run = promisify(execFile);

/** Every map is squared off to this before it ships. */
const TEXTURE_SIZE = 512;

/**
 * Which textures belong to which material.
 *
 * FBX2glTF brings the material *names* across but not their maps: the FBX
 * points at texture paths that do not exist outside the artist's machine, so
 * every material arrives bare. The names line up with the texture files by
 * hand, which is what this table is.
 *
 * Materials absent from it are not a mistake. Most of the room's 37 materials
 * are flat colours in the original too — chrome, glass, the lamp glow — and
 * they take a colour from PALETTE below instead.
 */
const TEXTURES = {
	Table: { base: "Table_BaseColor.tga", rough: "Table_Roughness.tga", metal: "Table_Metallic.tga" },
	Chair_1: { base: "Chair_1_BaseColor.tga", normal: "Chair_1_Normal.tga", rough: "Chair_1_Roughness.tga", metal: "Chair_1_Metallic.tga" },
	Chair_2: { base: "Chair_2_BaseColor.tga", normal: "Chair_2_Normal.tga", rough: "Chair_2_Roughness.tga", metal: "Chair_2_Metallic.tga" },
	Door: { base: "Door_BaseColor.tga", rough: "Door_Roughness.tga", metal: "Door_Metallic.tga" },
	Floor: { base: "Floor_Tile_basecolor.tga", normal: "Floor_Tile_normal.tga", rough: "Floor_Tile_roughness.tga" },
	Sofa: { base: "Sofa_BaseColor.tga", rough: "Sofa_Roughness.tga", metal: "Sofa_Metallic.tga" },
	Laptop_dark: { base: "Laptop_basecolor.tga", normal: "Laptop_N.tga" },
	// The panelling. Nothing in the export says which material wants the wood,
	// so this is read off the names: Luxury_Wood is the only wood set at panel
	// resolution, and Wall_Panel is the only material a panel could use.
	Wall_Panel: { base: "Luxury_Wood_basecolor.tga", normal: "Luxury_Wood_normal.tga", rough: "Luxury_Wood_roughness.tga" },
	Journals: { base: "Wood_A_v2.png", rough: "Wood_R_v2.png" },
	Curtains: { normal: "Curtains_N.png" },
};

/**
 * Colours for the materials that carry no map, sampled from what the name
 * says they are. Anything missing falls back to a mid grey, which reads as
 * unfinished rather than as a decision.
 */
const PALETTE = {
	Wall: [0.895, 0.878, 0.845],
	Wall_Lines: [0.62, 0.60, 0.575],
	Ceiling: [0.94, 0.935, 0.925],
	"Ceiling Color 2": [0.86, 0.855, 0.845],
	Plinth: [0.30, 0.245, 0.195],
	Chrome: [0.83, 0.85, 0.87],
	Metall_part: [0.55, 0.56, 0.58],
	White_Plastic: [0.92, 0.92, 0.93],
	Glass: [0.72, 0.80, 0.84],
	Mirror: [0.78, 0.82, 0.85],
	Display: [0.06, 0.07, 0.09],
	Display_plastic: [0.12, 0.12, 0.13],
	"Coffee Table": [0.28, 0.20, 0.15],
	"Coffee Table Bottom": [0.20, 0.15, 0.12],
	"Floor Lamp": [0.35, 0.35, 0.37],
	"Floor Lamp Glowing Part": [1.0, 0.93, 0.80],
	Lamp_Glow: [1.0, 0.94, 0.82],
	Lamp_Glow_2: [1.0, 0.94, 0.82],
	"Speaker Bottom": [0.13, 0.13, 0.14],
	"Speaker Plastic": [0.15, 0.15, 0.16],
	"Speaker diffuser": [0.10, 0.10, 0.11],
	"Speaker Chrome": [0.80, 0.82, 0.84],
	Picture_Frame_Color_1: [0.24, 0.18, 0.13],
	Picture_Frame_Color_2: [0.55, 0.45, 0.28],
	Picture_Art: [0.45, 0.47, 0.52],
	Curtains_transparent: [0.80, 0.82, 0.85],
	Curtains: [0.74, 0.76, 0.78],
};

/**
 * Meshes past this many triangles are simplified down towards it.
 *
 * One prop in the pack is wildly out of proportion to the rest: the speaker
 * tower is 20,188 triangles, a third of the whole room, for an object the size
 * of a fence post that stands against a wall. The same error tolerance the
 * prop pipeline uses in fetch-assets.mjs takes it back to something its screen
 * size deserves, and leaves everything under the threshold untouched.
 */
const SIMPLIFY_OVER = 6000;
const SIMPLIFY_ERROR = 0.005;

/** Materials that should glow rather than merely be pale. */
const EMISSIVE = new Set(["Lamp_Glow", "Lamp_Glow_2", "Floor Lamp Glowing Part", "Display"]);

/**
 * Left out of the conversion entirely.
 *
 * `Light_Blocking` is a lightmass shell, described in the header.
 *
 * `Speaker` is a 20,188-triangle floor-standing speaker -- a third of the whole
 * room, for a decorative object the size of a fence post. It cannot be reduced:
 * its grille is built as hundreds of separate closed shells, so there is no
 * edge meshoptimizer can collapse that does not delete a whole cone, and
 * simplify() returns it at full weight however hard it is pushed. That is the
 * same wall the Situation Room's chair casters hit, and the answer there was a
 * low-poly proxy. There is no proxy for this one, and the room does not need
 * it, so it is not converted.
 */
const SKIP_MESHES = new Set(["Light_Blocking", "Speaker"]);

/** `Coffee table.fbx` -> `CR_CoffeeTable.glb`. */
function outputName(stem) {
	const cleaned = stem
		.split(/[\s_]+/)
		.filter(Boolean)
		.map((part) => (part === part.toUpperCase() && part.length > 2 ? part[0] + part.slice(1).toLowerCase() : part[0].toUpperCase() + part.slice(1)))
		.join("");
	return `CR_${cleaned}`;
}

// ------------------------------------------------------------------- textures

/**
 * Decodes an uncompressed TGA to raw RGB(A).
 *
 * Only what this pack actually contains, which is all three of:
 *
 *   type 1  colour-mapped 8-bit, which is how most of the greyscale roughness
 *           and metallic maps are stored -- an index per pixel into a palette
 *   type 2  true-colour, 24-bit BGR or 32-bit BGRA
 *   type 3  plain greyscale, one byte a pixel and no palette
 *
 * Any of them may be written bottom-up, which is bit 5 of the image
 * descriptor: cleared means the first row in the file is the bottom row of the
 * picture. All seven combinations of type, depth and row order appear in this
 * one pack, so none of these branches is hypothetical.
 */
function readTga(buffer) {
	const idLength = buffer[0];
	const colourMapType = buffer[1];
	const imageType = buffer[2];
	const colourMapLength = buffer.readUInt16LE(5);
	const colourMapDepth = buffer[7];
	const width = buffer.readUInt16LE(12);
	const height = buffer.readUInt16LE(14);
	const depth = buffer[16];
	const topDown = (buffer[17] & 0x20) !== 0;

	if (imageType !== 1 && imageType !== 2 && imageType !== 3) {
		throw new Error(`TGA image type ${imageType} is not one this pack uses`);
	}

	let offset = 18 + idLength;
	let palette = null;
	if (colourMapType === 1) {
		const entryBytes = colourMapDepth / 8;
		palette = buffer.subarray(offset, offset + colourMapLength * entryBytes);
		offset += colourMapLength * entryBytes;
	}

	// Greyscale stays one channel; sharp reads that happily, and it is what the
	// roughness and metallic maps want to be anyway.
	const channels = imageType === 3 ? 1 : depth === 32 ? 4 : 3;
	const out = Buffer.alloc(width * height * channels);

	for (let y = 0; y < height; y++) {
		// Bottom-up files are read back to front, a row at a time.
		const sourceRow = topDown ? y : height - 1 - y;
		for (let x = 0; x < width; x++) {
			const target = (y * width + x) * channels;
			if (imageType === 3) {
				out[target] = buffer[offset + sourceRow * width + x];
			} else if (imageType === 1) {
				const index = buffer[offset + sourceRow * width + x];
				const entry = index * (colourMapDepth / 8);
				out[target] = palette[entry + 2];
				out[target + 1] = palette[entry + 1];
				out[target + 2] = palette[entry];
			} else {
				const source = offset + (sourceRow * width + x) * (depth / 8);
				out[target] = buffer[source + 2];
				out[target + 1] = buffer[source + 1];
				out[target + 2] = buffer[source];
				if (channels === 4) out[target + 3] = buffer[source + 3];
			}
		}
	}
	return { data: out, width, height, channels };
}

/** Any of the pack's formats, as a sharp pipeline squared off to `size`. */
async function loadImage(file, size = TEXTURE_SIZE) {
	const buffer = await readFile(file);
	if (!file.toLowerCase().endsWith(".tga")) {
		return sharp(buffer).resize(size, size, { fit: "fill" });
	}
	// Decoded once and handed to sharp as raw pixels. The base colour maps are
	// 48 MB each, so decoding to read the header and again to read the data is
	// a minute of wall clock across the set.
	const { data, width, height, channels } = readTga(buffer);
	return sharp(data, { raw: { width, height, channels } }).resize(size, size, { fit: "fill" });
}

/**
 * glTF's metallic-roughness texture, built from the pack's two greyscale maps:
 * roughness into green, metallic into blue, red left empty.
 */
async function packOrm(roughFile, metalFile, size = TEXTURE_SIZE) {
	// Allocated rather than created through sharp, which will not make a
	// single-channel image: its `create` wants three or four.
	const empty = Buffer.alloc(size * size, 0);

	const rough = roughFile
		? await (await loadImage(roughFile, size)).greyscale().raw().toBuffer()
		: empty;
	const metal = metalFile
		? await (await loadImage(metalFile, size)).greyscale().raw().toBuffer()
		: empty;

	return sharp(empty, { raw: { width: size, height: size, channels: 1 } })
		.joinChannel(rough, { raw: { width: size, height: size, channels: 1 } })
		.joinChannel(metal, { raw: { width: size, height: size, channels: 1 } })
		.webp({ quality: 88 })
		.toBuffer();
}

// --------------------------------------------------------------- the pipeline

async function convert(sourceDir, outDir, fbx2gltf) {
	const fbxDir = path.join(sourceDir, "FBX");
	const textureDir = path.join(sourceDir, "Textures");
	const temp = path.join(outDir, ".conference-room-tmp");
	await mkdir(temp, { recursive: true });

	const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
	const files = (await readdir(fbxDir)).filter((f) => /\.fbx$/i.test(f)).sort();

	let written = 0;
	let triangles = 0;
	let bytes = 0;
	const missing = new Set();

	for (const file of files) {
		const stem = path.basename(file, path.extname(file));
		if (SKIP_MESHES.has(stem)) {
			console.log(`  ${stem.padEnd(18)} skipped, deliberately -- see SKIP_MESHES`);
			continue;
		}

		const staged = path.join(temp, stem);
		await run(fbx2gltf, ["--binary", "--input", path.join(fbxDir, file), "--output", staged]);

		const document = await io.read(`${staged}.glb`);
		await dress(document, textureDir, missing);
		await document.transform(dedup(), prune());

		if (countTriangles(document) > SIMPLIFY_OVER) {
			// weld() first, because simplify has no edges to collapse across a
			// mesh whose vertices are split per face -- which is how these
			// export, so without it the ratio is met by deleting geometry
			// rather than by merging it.
			await document.transform(
				weld(),
				simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY_OVER / countTriangles(document), error: SIMPLIFY_ERROR }),
				prune(),
			);
		}

		const out = path.join(outDir, `${outputName(stem)}.glb`);
		await writeFile(out, await io.writeBinary(document));
		await godotReady(out, io);

		triangles += countTriangles(document);
		const size = (await stat(out)).size;
		bytes += size;
		written += 1;
		console.log(`  ${stem.padEnd(18)} -> ${path.basename(out).padEnd(22)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
	}

	await rm(temp, { recursive: true, force: true });

	if (missing.size > 0) {
		console.log(`\n  no colour or map for: ${[...missing].sort().join(", ")}`);
	}
	console.log(
		`\n  ${written} pieces, ${Math.round(triangles).toLocaleString()} triangles, ` +
			`${(bytes / 1048576).toFixed(2)} MB`,
	);
}

function countTriangles(document) {
	let total = 0;
	for (const mesh of document.getRoot().listMeshes()) {
		for (const primitive of mesh.listPrimitives()) {
			const indices = primitive.getIndices();
			const position = primitive.getAttribute("POSITION");
			total += (indices ? indices.getCount() : position ? position.getCount() : 0) / 3;
		}
	}
	return total;
}


/** Puts maps and colours on a converted piece's bare materials. */
async function dress(document, textureDir, missing) {
	for (const material of document.getRoot().listMaterials()) {
		const name = material.getName();
		const maps = TEXTURES[name];

		material.setRoughnessFactor(1.0);
		material.setMetallicFactor(maps?.metal ? 1.0 : 0.0);

		if (maps) {
			if (maps.base) {
				material.setBaseColorTexture(await makeTexture(document, path.join(textureDir, maps.base), `${name}_base`, true));
				material.setBaseColorFactor([1, 1, 1, 1]);
			}
			if (maps.normal) {
				material.setNormalTexture(await makeTexture(document, path.join(textureDir, maps.normal), `${name}_normal`, false));
			}
			if (maps.rough || maps.metal) {
				const packed = await packOrm(
					maps.rough ? path.join(textureDir, maps.rough) : null,
					maps.metal ? path.join(textureDir, maps.metal) : null,
				);
				const texture = document.createTexture(`${name}_orm`).setMimeType("image/webp").setImage(packed);
				material.setMetallicRoughnessTexture(texture);
			}
			if (!maps.base) applyColour(material, PALETTE[name], missing, name);
			continue;
		}

		applyColour(material, PALETTE[name], missing, name);
	}
}

function applyColour(material, colour, missing, name) {
	if (!colour) {
		missing.add(name);
		material.setBaseColorFactor([0.5, 0.5, 0.52, 1]);
		return;
	}
	material.setBaseColorFactor([...colour, 1]);
	// A polished surface with no roughness map still has to look polished.
	if (name.includes("Chrome") || name === "Mirror" || name === "Glass") {
		material.setRoughnessFactor(0.12);
		material.setMetallicFactor(name === "Glass" ? 0.0 : 1.0);
	}
	if (EMISSIVE.has(name)) {
		material.setEmissiveFactor(colour);
	}
}

async function makeTexture(document, file, name, srgb) {
	const image = await loadImage(file);
	const buffer = await (srgb ? image.webp({ quality: 86 }) : image.webp({ quality: 92, nearLossless: true })).toBuffer();
	return document.createTexture(name).setMimeType("image/webp").setImage(buffer);
}

// --------------------------------------------------------------------- the CLI

/** The pack, whether it was handed over as a folder or still as its zip. */
async function resolveSource(target) {
	const info = await stat(target).catch(() => null);
	if (!info) throw new Error(`no such path: ${target}`);
	if (info.isDirectory()) {
		// Accept either the folder itself or its parent.
		const here = await readdir(target);
		if (here.includes("FBX")) return target;
		const nested = here.find((n) => n.toLowerCase().includes("source files"));
		if (nested) return path.join(target, nested);
		throw new Error(`${target} has no FBX/ folder in it`);
	}
	throw new Error(`${target} is a file; unzip it first and pass the folder`);
}

const [target, ...rest] = process.argv.slice(2);
if (!target) {
	console.error("usage: node scripts/convert-conference-room.mjs <source dir> [--out public/models]");
	process.exit(1);
}
const outIndex = rest.indexOf("--out");
const outDir = outIndex >= 0 ? rest[outIndex + 1] : "public/models";

const fbx2gltf = process.env.FBX2GLTF ?? "FBX2glTF";
await run(fbx2gltf, ["--help"]).catch(() => {
	console.error(
		`cannot run '${fbx2gltf}'. Set FBX2GLTF to the binary, which is the one\n` +
			"the Process model workflow downloads:\n" +
			"  https://github.com/godotengine/FBX2glTF/releases",
	);
	process.exit(1);
});

const source = await resolveSource(target);
await mkdir(outDir, { recursive: true });
console.log(`Conference Room -> ${outDir}\n`);
await convert(source, outDir, fbx2gltf);
