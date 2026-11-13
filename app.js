// WeaveStore - web page
// file -> wif + preview, wif -> file

import { fileToWif, wifToFile, longestFloat } from "./lib/index.js";

const $ = (id) => document.getElementById(id);
const PREVIEW_PICKS = 240; // big files = giant canvas otherwise
const BIG_FILE = 2 * 1024 * 1024;
const WARP = "#2b2b33";
const WEFT = "#e8e0cc";

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showError(box, err) {
  box.textContent = err.message;
  box.classList.add("error");
}

// draw repeats across like the real warp
function drawCloth(grid, canvas, repeats = 4, cell = 4) {
  const shafts = grid[0].length;
  const picks = Math.min(grid.length, PREVIEW_PICKS);
  canvas.width = shafts * repeats * cell;
  canvas.height = picks * cell;
  const ctx = canvas.getContext("2d");

  for (let pick = 0; pick < picks; pick++) {
    for (let end = 0; end < shafts * repeats; end++) {
      const x = end * cell, y = pick * cell;
      const warpUp = grid[pick][end % shafts];
      ctx.fillStyle = warpUp ? WARP : WEFT;
      ctx.fillRect(x, y, cell, cell);
      // thin shadow, reads as thread
      ctx.fillStyle = "rgba(0,0,0,.15)";
      if (warpUp) ctx.fillRect(x + cell - 1, y, 1, cell);
      else ctx.fillRect(x, y + cell - 1, cell, 1);
    }
  }
}

$("file-in").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const info = $("weave-info");
  info.classList.remove("error");
  $("save-wif").hidden = true;

  if (file.size > BIG_FILE && !confirm("That's a big file, the draft will be huge and slow. Go anyway?")) return;
  info.textContent = "weaving...";

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const shafts = Number($("shafts").value);
    const { wif, grid } = await fileToWif(bytes, file.name, shafts);
    const hash = toHex(await crypto.subtle.digest("SHA-256", bytes));

    drawCloth(grid, $("cloth"));
    const shown = grid.length > PREVIEW_PICKS ? `, preview shows first ${PREVIEW_PICKS}` : "";
    info.textContent =
      `${file.name}, ${bytes.length} bytes\n` +
      `${grid.length} picks on ${shafts} shafts${shown}\n` +
      `longest float ${longestFloat(grid)}, about ${(grid.length / 1000).toFixed(2)} m of cloth\n` +
      `sha256 ${hash}`;

    $("save-wif").hidden = false;
    $("save-wif").onclick = () => download(wif, `${file.name}.wif`, "text/plain");
  } catch (err) {
    showError(info, err);
  }
});

$("wif-in").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const info = $("unweave-info");
  info.classList.remove("error");
  $("save-file").hidden = true;
  info.textContent = "unweaving...";

  try {
    const { name, data, hash } = await wifToFile(await file.text());
    info.textContent = `got ${name} back, ${data.length} bytes\nsha256 ${toHex(hash)}`;
    $("save-file").hidden = false;
    $("save-file").onclick = () => download(data, name, "application/octet-stream"); // name already stripped
  } catch (err) {
    showError(info, err);
  }
});