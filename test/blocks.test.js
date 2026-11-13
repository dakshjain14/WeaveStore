// Test for blocks.js
//Checks that encoding/decoding works and that cloth is not corrupted

import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS, SIZE, isLegal, bytesToBlocks, blocksToBytes } from "../lib/blocks.js";

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

//This lays blocks out in a grid like cloth, across blocks in each row
//Gives a plan 2D array of 0s and 1s

function tile(blocks, across) {
    const grid = [];
    blocks.forEach((block, k) => {
        const top = Math.floor(k / across) * SIZE, left = (k % across) * SIZE;
        for (let r = 0; r < SIZE; r++) {
            grid[top + r] ??= [];
            for (let c = 0; c < SIZE; c++) grid[top + r][left + c] = (block >> (r * SIZE + c)) & 1;
        }
    });
    return grid;
}

//Finds float in grid, checks every row and column
function longestFloat(grid) {
    let lowest = 0;
    const scan = (cells) => {
        let run = 1;
        for (let i = 1; i < cells.length; i++) {
            run = cells[i] === cells[i - 1] ? run + 1 : 1;
            lowest = Math.max(lowest, run);
        }
    };
    grid.forEach(scan); //rows
    grid[0].forEach((_, c) => scan(grid.map((row) => row[c]))); //columns
    return lowest;
}

//this was counted by hand
test("2030 legal blocks", () => {
    assert.equal(BLOCKS.length, 2030);
});

// Solid blocks would make massive floats, so they should never get in
test("no all-up or all-down block", () => {
  assert.ok(!isLegal(0x0000));
  assert.ok(!isLegal(0xffff));
});

// Throw random blocks together 200 times and make sure nothing goes past 4
test("random cloth never floats over 4", () => {
  for (let trial = 0; trial < 200; trial++) {
    const picks = Array.from({ length: 64 }, () => BLOCKS[Math.floor(Math.random() * BLOCKS.length)]);
    assert.ok(longestFloat(tile(picks, 8)) <= 4); // 8x8 blocks = 32x32 cells
  }
});

// The other direction: 4 should actually happen
// Something like 0011 next to 1100 does it
test("worst case hits exactly 4", () => {
  const worst = Math.max(...BLOCKS.slice(0, 200).map((a) =>
    Math.max(...BLOCKS.slice(0, 200).map((b) => longestFloat(tile([a, b], 2))))));
  assert.equal(worst, 4);
});

// Weird lengths on purpose, since most aren't a multiple of 4. 0 is the empty file case
test("round trip, odd lengths", () => {
  for (const len of [0, 1, 2, 3, 4, 5, 7, 8, 13, 1000, 4096]) {
    const bytes = randomBytes(len);
    const back = blocksToBytes(bytesToBlocks(bytes));
    assert.deepEqual(back.slice(0, len), bytes); // slice off the padding before comparing
  }
});

// 0xffffffff is the biggest word there is, so if anything overflows it'll be this
test("all 0xff still fits", () => {
  const bytes = new Uint8Array(8).fill(0xff);
  assert.deepEqual(blocksToBytes(bytesToBlocks(bytes)), bytes);
});

// Swap in a block thats definitely not allowed and make sure decoding complains
test("illegal block caught", () => {
  const blocks = bytesToBlocks(randomBytes(4));
  blocks[1] = 0xffff; // solid block, never legal
  assert.throws(() => blocksToBytes(blocks), /illegal block/);
});