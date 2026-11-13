// tests for wif.js + the full trip

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileToWif, wifToFile } from "../lib/index.js";
import { gridFromWif, toWif } from "../lib/wif.js";

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const text = (s) => new TextEncoder().encode(s);

test("file -> wif -> file", async () => {
  const files = [randomBytes(2000), text("hello loom ".repeat(200)), new Uint8Array(0)];
  for (const data of files) {
    const { wif } = await fileToWif(data, "thing.bin");
    const back = await wifToFile(wif);
    assert.equal(back.name, "thing.bin");
    assert.deepEqual(back.data, data);
  }
});

test("wif has the bits it needs", async () => {
  const { wif, grid } = await fileToWif(randomBytes(300), "x");
  for (const name of ["[WIF]", "[WEAVING]", "[THREADING]", "[LIFTPLAN]"]) assert.ok(wif.includes(name));
  assert.ok(wif.includes(`Threads=${grid.length}`)); // weft count
});

// what a loom program might resave it as
test("treadling instead of liftplan", async () => {
  const { wif, grid } = await fileToWif(randomBytes(500), "x");
  // Array.from not .map, Uint8Array.map kills the strings
  const tieup = ["[TIEUP]", ...Array.from(grid[0], (_, i) => `${i + 1}=${i + 1}`), "", ""].join("\r\n");
  const treadled = wif.replace("[LIFTPLAN]", tieup + "[TREADLING]");
  assert.deepEqual(gridFromWif(treadled), grid);
});

// flip every cell, say sinking shed, should read the same
test("sinking shed", async () => {
  const { grid } = await fileToWif(randomBytes(500), "x");
  const flipped = grid.map((row) => row.map((cell) => 1 - cell));
  const sinking = toWif(flipped).replace("Rising Shed=true", "Rising Shed=false");
  assert.deepEqual(gridFromWif(sinking), grid);
});

test("not a wif", async () => {
  await assert.rejects(wifToFile("[WEAVING]\r\nShafts=16\r\n"), /no liftplan/);
});

// flip shaft 1 on pick 1, lands in the magic bytes
test("damaged draft caught", async () => {
  const { wif } = await fileToWif(randomBytes(500), "x");
  const at = wif.indexOf("[LIFTPLAN]");
  const lines = wif.slice(at).split("\r\n");
  const lifted = lines[1].slice(2).split(",").filter(Boolean);
  const changed = lifted.includes("1") ? lifted.filter((s) => s !== "1") : ["1", ...lifted];
  lines[1] = "1=" + changed.join(",");
  await assert.rejects(wifToFile(wif.slice(0, at) + lines.join("\r\n")));
});