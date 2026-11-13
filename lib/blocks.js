// A cloth is a grid of cells. 1 means the warp is on top, 0 means the weft is on top. The grid is stored as a 1D array of 0s and 1s, with the first row first, then the second row, etc.
//We chop it into 4x4 blocks and only allow blocks where no row or column has more than 2 of the same value in a row.
// Why? Two blocks next to each other can then make a float of at most 2 + 2 = 4,
// so the cloth never gets long loose threads that snag. Same idea as RLL codes on hard drives!

export const SIZE = 4;
export const MAX_RUN = 2;

const LINE_MASK = (1<<SIZE) - 1; // 0b1111, grabs one row


// Longest streak of the same bit in a line. 0110 -> 2, 0001 -> 3
function longestRun(word, len) {
  let best = 1, run = 1;
  for (let i = 1; i < len; i++) {
    run = ((word >> i) & 1) === ((word >> (i - 1)) & 1) ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

//There are only 16 possible lines, so we work them out at the front
const goodline = Array.from({length:LINE_MASK+1}, (_, w) => longestRun(w, SIZE) <= MAX_RUN);

export function getrow (block, r){
    return (block >> (r*SIZE)) & LINE_MASK;
}

//Columns are spread out so we have to pick them one at a time
export function getCol(block, c) {
  let col = 0;
  for (let r = 0; r < SIZE; r++) col |= ((block >> (r * SIZE + c)) & 1) << r;
  return col;
}

//A block is legal if all rows and all columns are legal
export function islegal (block) {
  for (let i = 0; i < SIZE; i++) {
    if (!goodLine[getRow(block, i)] || !goodLine[getCol(block, i)]) return false;
  }
  return true;
}

//There are only 65526 blocks, so we just check all of them
export const BLOCKS = [];
for (let b = 0; b < 1 << (SIZE * SIZE); b++) if (isLegal(b)) BLOCKS.push(b);

const BASE = BLOCKS.length; // should be 2030, the test checks this
const blockIndex = new Map(BLOCKS.map((b, i) => [b, i])); // block -> its digit, for decoding

