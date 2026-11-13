// WeaveStore - round trip check
// node cli/roundtrip.js cat.jpg [shafts]
// file -> .wif -> file, compares sha256

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename } from "node:path";
import { fileToWif, wifToFile, longestFloat } from "../lib/index.js";

const [path, shaftArg = "16"] = process.argv.slice(2);
if (!path) {
  console.log("usage: node cli/roundtrip.js <file> [shafts]");
  process.exit(1);
}

const shafts = Number(shaftArg);
const bytes = new Uint8Array(await readFile(path));
const hex = (buf) => Buffer.from(buf).toString("hex");
const sha = async (buf) => hex(await crypto.subtle.digest("SHA-256", buf));

// weave
const { wif, grid } = await fileToWif(bytes, basename(path), shafts);
const wifPath = `${path}.wif`;
await writeFile(wifPath, wif);

// read back from disk, not memory
const back = await wifToFile(await readFile(wifPath, "utf8"));
await mkdir("recovered", { recursive: true });
const outPath = `recovered/${back.name}`; // folders already stripped
await writeFile(outPath, back.data);

const before = await sha(bytes);
const after = await sha(back.data);

console.log(`${basename(path)}, ${bytes.length} bytes`);
console.log(`${grid.length} picks on ${shafts} shafts, longest float ${longestFloat(grid)}`);
console.log(`${(bytes.length / grid.length).toFixed(2)} bytes per pick`);
console.log(`~${(grid.length / 1000).toFixed(2)} m of cloth at 10 picks/cm`);
console.log(`wrote ${wifPath} and ${outPath}`);
console.log(`in   ${before}`);
console.log(`out  ${after}`);
console.log(before === after ? "match :)" : "MISMATCH");
process.exitCode = before === after ? 0 : 1;