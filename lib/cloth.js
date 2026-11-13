// WeaveStore - cloth
// blocks <-> grid of cells, grid[pick][shaft]
// 1 = shaft up = warp on top
// straight draw, end n on shaft n, repeats across

import { SIZE, BLOCKS, bytesToBlocks, blocksToBytes } from "./blocks.js";

// picks needed for a blob, without weaving it
export function picksFor(blobLength, shafts) {
  const blocks = Math.ceil(blobLength / 4) * 3;
  const across = shafts / SIZE;
  return Math.max(1, Math.ceil(blocks / across)) * SIZE;
}

export function weave(blob, shafts = 16) {
  if (!shafts || shafts % SIZE) throw new Error(`shafts must be a multiple of ${SIZE}`);
  const blocks = bytesToBlocks(blob);
  const across = shafts / SIZE;
  const grid = Array.from({ length: picksFor(blob.length, shafts) }, () => new Uint8Array(shafts));
  const total = (grid.length / SIZE) * across;

  for (let k = 0; k < total; k++) {
    const block = blocks[k] ?? BLOCKS[0]; // filler for last band
    const top = Math.floor(k / across) * SIZE;
    const left = (k % across) * SIZE;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        grid[top + r][left + c] = (block >> (r * SIZE + c)) & 1;
  }
  return grid;
}

export function unweave(grid) {
  if (!grid.length) throw new Error("no picks in this draft");
  const shafts = grid[0].length;
  if (shafts % SIZE || grid.length % SIZE) throw new Error("cloth isn't whole blocks");

  const blocks = [];
  for (let top = 0; top < grid.length; top += SIZE) {
    for (let left = 0; left < shafts; left += SIZE) {
      let block = 0;
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          block |= grid[top + r][left + c] << (r * SIZE + c);
      blocks.push(block);
    }
  }
  // filler blocks = digit 0, harmless
  // just keep whole groups of 3
  blocks.length -= blocks.length % 3;
  return blocksToBytes(blocks);
}

// longest float anywhere
// rows wrap (warp repeats across), cols don't
// no copies, big drafts are big
export function longestFloat(grid) {
  const shafts = grid[0].length;
  let longest = 0;

  for (const row of grid) {
    let run = 1;
    for (let i = 1; i < shafts * 2; i++) {
      run = row[i % shafts] === row[(i - 1) % shafts] ? run + 1 : 1;
      if (run > longest) longest = run;
    }
  }

  for (let s = 0; s < shafts; s++) {
    let run = 1;
    for (let p = 1; p < grid.length; p++) {
      run = grid[p][s] === grid[p - 1][s] ? run + 1 : 1;
      if (run > longest) longest = run;
    }
  }
  return longest;
}