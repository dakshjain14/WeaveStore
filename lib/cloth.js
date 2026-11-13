// WeaveStore - cloth
// blocks <-> grid of cells, grid[pick][shaft]
// 1 = shaft up = warp on top
// straight draw, end n on shaft n, repeats across

import {SIZE, BLOCKS, bytesToBlocks, blocksToBytes} from "./blocks.js";

export function weave(blob, shafts = 16) {
    if (!shafts || shafts % SIZE) throw new Error(`shafts must be a multiple of ${SIZE}`);
    const blocks = bytesToBlocks(blob);
    const across = shafts / SIZE;
    const bands = Math.max(1, Math.ceil(blocks.length / across));
    const grid = Array.from({ length: bands * SIZE }, () => new Uint8Array(shafts));

    for (let k = 0; k < bands * across; k++) {
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
    if (!grid.length) throw new Error("no picks in this drafft");
    const shafts = grid[0].length;
    if (shafts % SIZE || grid.length % SIZE) throw new Error("Cloth isnt whole blocks");

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

  //filler blocks of digit 0 are ok
  // Only need to keep groups of 3
  blocks.length -= blocks.length % 3;
  return blocksToBytes(blocks);
}

export function longestFloat(grid) {
    let longest = 0;
    const scan = (cells) => {
        let run = 1;
        for (let i = 1; i < cells.length; i++) {
            run = cells[i] === cells[i - 1] ? run + 1 : 1;
            longest = Math.max(longest, run);
        }
    };

    //rows doubled, right edge meets the left edge
    for (const row of grid) scan([...row, ...row]);
    //columns dont wrap
    for (let s = 0; s < grid[0].length; s++) scan(grid.map((row) => row[s]));
    return longest;
}  