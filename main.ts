// news-image-20261119 entry: "The World in One Day" — a newspaper front page
// summing up Thursday 19 November 2026 in one 1024x1024 PNG.
//
// The image is rendered from page.html (kept outside this repo) with headless
// Chromium and shipped here as entry.png. This program only verifies the file
// the gate will see and copies it to the output directory, so both grading
// runs write exactly the same bytes.
//
// The day's stories (researched 19 Nov 2026, before the entry was built):
//   1. Gulf war widens to Kuwait and Bahrain as the U.S. hits Qeshm Island
//   2. Trump, Xi and Putin hold their first trilateral summit in Shenzhen
//   3. House Democrats nominate Hakeem Jeffries for Speaker, 251–11
//   4. Grand Theft Auto VI rolls out worldwide after 13 years
//   5. COP31 draft deal under fire two days before Friday's deadline
//   6. Cyclone Akvan bears down on India's Andhra coast
//   Also: Voyager 1 one light-day from Earth; EU proposes €45bn Ukraine
//   loan; Nvidia's acting CEO promises earlier pay raises.
//
// Revision: the gate expects exactly one 1024x1024 image, so the checks
// below now demand those exact dimensions (not just "at most") and also
// confirm the file ends with a proper IEND chunk, so a truncated render
// is caught instead of shipped.

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "entry.png");
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const target = join(outDir, "entry.png");

const bytes = readFileSync(source);

// The gate only accepts a whole PNG or JPEG. Refuse to ship anything else
// rather than letting a corrupt file through as a silent invalid entry.
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
for (let i = 0; i < pngSignature.length; i += 1) {
  if (bytes[i] !== pngSignature[i]) {
    throw new Error("entry.png is not a PNG file (bad signature)");
  }
}

// Gate cap: at most 1 MiB.
if (bytes.length > 1048576) {
  throw new Error(`entry.png is ${bytes.length} bytes, over the 1 MiB cap`);
}

// Gate cap: at most 1024 by 1024 pixels. The IHDR chunk starts at byte 8
// (4-byte length, "IHDR") and holds width and height as big-endian uint32.
const ihdrLength = bytes.readUInt32BE(8);
const ihdrType = bytes.toString("latin1", 12, 16);
if (ihdrLength !== 13 || ihdrType !== "IHDR") {
  throw new Error("entry.png has no valid IHDR chunk");
}
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width !== 1024 || height !== 1024) {
  throw new Error(`entry.png is ${width}x${height}, expected exactly 1024x1024`);
}

// A well-formed PNG ends with a 12-byte IEND chunk (length 0, "IEND",
// CRC). A truncated render would fail here instead of shipping.
const tail = bytes.subarray(bytes.length - 12);
if (tail.readUInt32BE(0) !== 0 || tail.toString("latin1", 4, 8) !== "IEND") {
  throw new Error("entry.png has no valid trailing IEND chunk");
}

mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);
console.log(`entry.png: ${width}x${height}, ${bytes.length} bytes -> ${target}`);
