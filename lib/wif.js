// WeaveStore - wif files
// grid -> .wif text and back
// writes liftplan, reads liftplan OR tieup + treadling
// sinking shed flips everything

import { SIZE } from "./blocks.js";

const NO = ["false", "no", "off", "0"];

export function toWif(grid, { title = "WeaveStore", repeats = 4 } = {}) {
  const shafts = grid[0].length;
  const ends = shafts * repeats;
  const lines = [];
  const section = (name, rows) => {
    lines.push(`[${name}]`, ...rows.map(([key, value]) => `${key}=${value}`), "");
  };

  section("WIF", [
    ["Version", "1.1"],
    ["Date", new Date().toDateString()],
    ["Developers", "WeaveStore"],
    ["Source Program", "WeaveStore"],
    ["Source Version", "0.1"],
  ]);
  section("CONTENTS", ["TEXT", "WEAVING", "WARP", "WEFT", "COLOR PALETTE", "COLOR TABLE",
    "THREADING", "LIFTPLAN"].map((name) => [name, "true"]));
  section("TEXT", [["Title", title.replace(/[\r\n]/g, " ")]]); // no newlines in ini values
  section("WEAVING", [["Shafts", shafts], ["Treadles", shafts], ["Rising Shed", "true"]]);
  section("WARP", [["Threads", ends], ["Color", 1]]);
  section("WEFT", [["Threads", grid.length], ["Color", 2]]);
  section("COLOR PALETTE", [["Entries", 2], ["Range", "0,255"]]);
  section("COLOR TABLE", [[1, "43,43,51"], [2, "232,224,204"]]);
  section("THREADING", Array.from({ length: ends }, (_, end) => [end + 1, (end % shafts) + 1]));
  // shafts that go up each pick
  section("LIFTPLAN", grid.map((row, pick) =>
    [pick + 1, [...row].flatMap((up, shaft) => (up ? [shaft + 1] : [])).join(",")]));

  return lines.join("\r\n");
}

// plain ini, keys lowercased
export function parseWif(text) {
  const sections = {};
  let current = null;
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith(";")) continue;
    const heading = line.match(/^\[(.+)\]$/);
    if (heading) {
      current = sections[heading[1].trim().toLowerCase()] = {};
      continue;
    }
    const eq = line.indexOf("=");
    if (current && eq > 0) current[line.slice(0, eq).trim().toLowerCase()] = line.slice(eq + 1).trim();
  }
  return sections;
}

// "1,3,5" -> [1, 3, 5]
const nums = (value) => (value ?? "").split(",").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));

export function gridFromWif(text) {
  const wif = parseWif(text);
  const weaving = wif.weaving ?? {};
  const shafts = parseInt(weaving.shafts, 10);
  if (!shafts || shafts % SIZE) throw new Error(`shaft count has to be a multiple of ${SIZE}`);
  const rising = !NO.includes((weaving["rising shed"] ?? "true").toLowerCase());

  // which shafts move on a pick
  let moved;
  if (wif.liftplan) moved = (pick) => nums(wif.liftplan[pick]);
  else if (wif.treadling && wif.tieup)
    moved = (pick) => nums(wif.treadling[pick]).flatMap((treadle) => nums(wif.tieup[treadle]));
  else throw new Error("no liftplan or treadling in this wif");

  const plan = wif.liftplan ?? wif.treadling;
  const picks = parseInt(wif.weft?.threads, 10) || Math.max(0, ...Object.keys(plan).map(Number));

  // first repeat is enough
  const threading = Array.from({ length: shafts }, (_, end) => nums(wif.threading?.[end + 1]));

  const grid = [];
  for (let pick = 1; pick <= picks; pick++) {
    const shaftsMoved = new Set(moved(pick));
    const row = new Uint8Array(shafts);
    threading.forEach((onShafts, end) => {
      const hit = onShafts.some((s) => shaftsMoved.has(s));
      row[end] = hit === rising ? 1 : 0; // sinking shed = opposite
    });
    grid.push(row);
  }
  return grid;
}