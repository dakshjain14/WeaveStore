// tests for cloth.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { weave, unweave, longestFloat } from "../lib/cloth.js";

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

test("round trip on 8, 16, 24 shafts", () => {
  for (const shafts of [8, 16, 24]) {
    const blob = randomBytes(777);
    const back = unweave(weave(blob, shafts));
    assert.deepEqual(back.slice(0, blob.length), blob); // padding after
  }
});

// wrap included, the real cloth repeats
test("floats never over 4", () => {
  for (const shafts of [8, 16, 24]) {
    assert.ok(longestFloat(weave(randomBytes(5000), shafts)) <= 4);
  }
});

test("whole blocks only", () => {
  const grid = weave(randomBytes(101), 16);
  assert.equal(grid.length % 4, 0);
  assert.ok(grid.every((row) => row.length === 16));
});

// empty liftplan line would be weird in a loom program
test("every pick lifts something", () => {
  const grid = weave(randomBytes(2000), 16);
  assert.ok(grid.every((row) => row.some((cell) => cell === 1)));
});

test("bad shaft count", () => {
  assert.throws(() => weave(randomBytes(10), 10), /multiple of 4/);
});