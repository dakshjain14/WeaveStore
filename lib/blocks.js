// A cloth is a grid of cells. 1 means the warp is on top, 0 means the weft is on top. Each block is one 16-bit number, with row 0 in the lowest 4 bits, then row 1, etc.
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

export function getRow (block, r){
    return (block >> (r*SIZE)) & LINE_MASK;
}

//Columns are spread out so we have to pick them one at a time
export function getCol(block, c) {
  let col = 0;
  for (let r = 0; r < SIZE; r++) col |= ((block >> (r * SIZE + c)) & 1) << r;
  return col;
}

//A block is legal if all rows and all columns are legal
export function isLegal (block) {
  for (let i = 0; i < SIZE; i++) {
    if (!goodline[getRow(block, i)] || !goodline[getCol(block, i)]) return false;
  }
  return true;
}

//There are only 65536 blocks, so we just check all of them
export const BLOCKS = [];
for (let b = 0; b < 1 << (SIZE * SIZE); b++) if (isLegal(b)) BLOCKS.push(b);

const BASE = BLOCKS.length; // should be 2030, the test checks this

// block -> its digit, -1 = illegal
// flat table, faster than a Map
const digitOf = new Int16Array(1 << (SIZE * SIZE)).fill(-1);
BLOCKS.forEach((b, i) => { digitOf[b] = i; });

//2030^3 is more than 2^32, so 3 blocks can hold 4 bytes.

if (BASE ** 3 < 2 ** 32) throw new Error("Block base is too small to hold 4 bytes");

export function bytesToBlocks(bytes){
    //We pad with 0s, so that we have whole 4-byte words
    //The header holds the real length, and extra xeroes are cut off
    const words = Math.ceil(bytes.length / 4);
    const padded = new Uint8Array(words * 4);
    padded.set(bytes);
    const view = new DataView(padded.buffer);

    const blocks = new Uint16Array(words * 3); // way less memory than a normal array
    for (let i = 0; i < words; i++){
        let value = view.getUint32(i * 4);
        //Write in base 2030 with smallest digit first
        //Each digit picks one block
        for (let k = 0; k < 3; k++){
            blocks[i * 3 + k] = BLOCKS[value % BASE];
            value = Math.floor(value / BASE)
        }
    }
    return blocks;
}

// Same thing backwards. The padding is trimmed later by the header
export function blocksToBytes(blocks) {
  if (blocks.length % 3) throw new Error("block count not a multiple of 3");
  const out = new Uint8Array((blocks.length / 3) * 4);
  const view = new DataView(out.buffer);

  for (let i = 0; i < blocks.length; i += 3) {
    let value = 0;
    // Biggest digit first this time, since we're building the number back up
    for (let k = 2; k >= 0; k--) {
      const digit = digitOf[blocks[i + k]];
      if (digit === undefined || digit < 0) throw new Error(`illegal block at #${i + k}`);
      value = value * BASE + digit;
    }
    // 2030^3 is bigger than 2^32, so some combos can't come from real data.
    // If we see one the draft got messed up somewhere. Free error check :)
    if (value > 0xffffffff) throw new Error(`block group #${i / 3} out of range, draft damaged?`);
    view.setUint32((i / 3) * 4, value);
  }
  return out;
}