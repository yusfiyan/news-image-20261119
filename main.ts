// news-image-20261119 — validate and publish the day's front page.
//
// "The World in One Day — Thursday 19 November 2026" sums up the day in a
// single 1024x1024 newspaper image. The six stories on the page:
//
//   1. The Gulf war spreads to Kuwait: US jets hit a missile site on
//      Qeshm Island, while Iran claims strikes on a base in Kuwait and
//      on radar in Bahrain.
//   2. Trump, Xi and Putin meet in Shenzhen for a first trilateral
//      summit.
//   3. Hakeem Jeffries is nominated to become the first Black Speaker
//      of the US House.
//   4. Grand Theft Auto VI launches worldwide after a thirteen-year wait.
//   5. The COP31 draft text comes under fire in Antalya two days before
//      the deadline.
//   6. Cyclone Akvan bears down on India, with a red alert on the
//      Andhra coast.
//
// The "Also today" strip adds three more: Voyager 1 is one light-day from
// Earth, the EU proposes a 45-billion-euro loan for Ukraine, and Nvidia's
// acting chief executive promises earlier pay raises.
//
// This program checks entry.png (kept beside this file) and copies it to
// the output directory. Node 22, standard library only, no network.

import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1048576;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;

// The PNG signature: the first eight bytes of every PNG file.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// The IEND trailer: length 0, type "IEND", CRC 0xae426082.
const IEND_TRAILER = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = join(here, "entry.png");
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

  let stats;
  try {
    stats = statSync(source);
  } catch {
    fail(`cannot read ${source}`);
  }
  if (stats.size > MAX_BYTES) {
    fail(`entry.png is ${stats.size} bytes, over the ${MAX_BYTES} byte limit`);
  }

  const bytes = readFileSync(source);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail("entry.png does not start with the PNG signature");
  }

  // The first chunk must be IHDR: 4-byte length, 4-byte type "IHDR",
  // then width and height as 4-byte big-endian integers.
  if (bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail("entry.png does not start with an IHDR chunk");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    fail(`entry.png is ${width}x${height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`);
  }

  // Walk the chunk chain from the start so a stray IEND-shaped tail or
  // trailing junk cannot pass: every chunk must fit inside the file, and
  // the chain must end exactly on a well-formed IEND chunk.
  let offset = 8;
  let sawIend = false;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const next = offset + 12 + length;
    if (next > bytes.length) {
      fail(`chunk ${type} at offset ${offset} runs past the end of the file`);
    }
    if (type === "IEND") {
      if (length !== 0 || next !== bytes.length) {
        fail("IEND chunk is malformed or is not the last chunk");
      }
      if (!bytes.subarray(bytes.length - 12).equals(IEND_TRAILER)) {
        fail("entry.png does not end with a valid IEND trailer");
      }
      sawIend = true;
      break;
    }
    offset = next;
  }
  if (!sawIend) {
    fail("entry.png has no IEND chunk");
  }

  mkdirSync(outDir, { recursive: true });
  const destination = join(outDir, "entry.png");
  copyFileSync(source, destination);

  console.log(`entry.png: ${width}x${height}, ${bytes.length} bytes`);
  console.log(`copied to ${destination}`);
}

main();
