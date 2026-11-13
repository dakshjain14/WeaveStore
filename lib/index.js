// WeaveStore - the whole trip
// file -> header -> blocks -> cloth -> wif, and back

import { pack, unpack } from "./header.js";
import { weave, unweave, longestFloat, picksFor } from "./cloth.js";
import { toWif, gridFromWif } from "./wif.js";

export { longestFloat, picksFor };

// 4 shafts = 0.33, 16 = 1.33, 24 = 2
export const bytesPerPick = (shafts) => shafts / 12;

export async function fileToWif(bytes, name, shafts = 16, maxPicks = Infinity) {
  const blob = await pack(bytes, name);

  // check after compressing, before building the grid
  const picks = picksFor(blob.length, shafts);
  if (picks > maxPicks) {
    throw new Error(`too big: needs ${picks.toLocaleString()} picks on ${shafts} shafts, the limit here is ${maxPicks.toLocaleString()}`);
  }

  const grid = weave(blob, shafts);
  return { wif: toWif(grid, { title: name }), grid };
}

export async function wifToFile(text) {
  return unpack(unweave(gridFromWif(text)));
}