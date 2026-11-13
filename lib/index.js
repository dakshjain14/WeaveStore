// WeaveStore - the whole trip
// file -> header -> blocks -> cloth -> wif, and back

import { pack, unpack } from "./header.js";
import { weave, unweave, longestFloat } from "./cloth.js";
import { toWif, gridFromWif } from "./wif.js";

export { longestFloat };

export async function fileToWif(bytes, name, shafts = 16) {
  const grid = weave(await pack(bytes, name), shafts);
  return { wif: toWif(grid, { title: name }), grid };
}

export async function wifToFile(text) {
  return unpack(unweave(gridFromWif(text)));
}