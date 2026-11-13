// tests for header.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { pack, unpack } from "../lib/header.js";
import { bytesToBlocks, blocksToBytes } from "../lib/blocks.js";

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const text = (s) => new TextEncoder().encode(s);

test("random bytes round trip", async () => {
  const data = randomBytes(5000);
  const back = await unpack(await pack(data, "noise.bin"));
  assert.equal(back.name, "noise.bin");
  assert.deepEqual(back.data, data);
});

// random = can't compress, flag stays off
test("random data stored raw", async () => {
  const blob = await pack(randomBytes(1000), "noise.bin");
  assert.equal(blob[5] & 1, 0);
});

// repeating text squashes a lot
test("text gets compressed", async () => {
  const data = text("hello loom ".repeat(500));
  const blob = await pack(data, "a.txt");
  assert.equal(blob[5] & 1, 1);
  assert.ok(blob.length < data.length / 10);
  assert.deepEqual((await unpack(blob)).data, data);
});

test("empty file", async () => {
  const back = await unpack(await pack(new Uint8Array(0), "empty"));
  assert.equal(back.data.length, 0);
});

test("emoji filename", async () => {
  const back = await unpack(await pack(text("hi"), "🧶 scarf.txt"));
  assert.equal(back.name, "🧶 scarf.txt");
});

// 100 emoji = 400 bytes, should cut to 63 whole
test("long name cut cleanly", async () => {
  const back = await unpack(await pack(text("hi"), "🧶".repeat(100)));
  assert.equal(back.name, "🧶".repeat(63));
});

test("folders stripped", async () => {
  const back = await unpack(await pack(text("hi"), "../../evil.txt"));
  assert.equal(back.name, "evil.txt");
});

// blocks.js padding etc
test("trailing zeros ignored", async () => {
  const data = randomBytes(100);
  const blob = await pack(data, "x");
  const padded = new Uint8Array(blob.length + 37);
  padded.set(blob);
  assert.deepEqual((await unpack(padded)).data, data);
});

test("wrong magic", async () => {
  const blob = await pack(text("hi"), "x");
  blob[0] = 0;
  await assert.rejects(unpack(blob), /not a WeaveStore draft/);
});

test("cut off", async () => {
  const blob = await pack(randomBytes(100), "x");
  await assert.rejects(unpack(blob.slice(0, -1)), /cut off/);
});

// one flipped bit will get caught
test("flipped bit caught", async () => {
  const blob = await pack(randomBytes(100), "x");
  blob[blob.length - 1] ^= 1;
  await assert.rejects(unpack(blob), /hash mismatch/);
});

// header + blocks together
test("through the blocks and back", async () => {
  const data = randomBytes(3333);
  const blocks = bytesToBlocks(await pack(data, "photo.jpg"));
  const back = await unpack(blocksToBytes(blocks));
  assert.equal(back.name, "photo.jpg");
  assert.deepEqual(back.data, data);
});