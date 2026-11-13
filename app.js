// WeaveStore - web page
// file -> wif + preview, wif -> file

import { fileToWif, wifToFile, longestFloat, bytesPerPick } from "./lib/index.js";

const $ = (id) => document.getElementById(id);

const MAX_PICKS = 1_000_000; // ~1.3 MB at 16 shafts
const MAX_READ = 50 * 1024 * 1024; // don't even read past this
const PREVIEW_PICKS = 200;
const PICKS_PER_CM = 10; // rough, depends on yarn
const WARP = "#28365e"; // indigo
const WEFT = "#ebe5d8"; // undyed cotton

let lastFile = null; // re-weave when shafts change

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function formatSize(bytes) {
  if (bytes < 1024) return `${Math.round(bytes)} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatLength(picks) {
  const cm = picks / PICKS_PER_CM;
  return cm < 100 ? `${Math.round(cm)} cm` : `${(cm / 100).toFixed(1)} m`;
}

function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showError(box, message) {
  box.textContent = message;
  box.classList.add("error");
}

function showShaftHint() {
  const perPick = bytesPerPick(Number($("shafts").value));
  $("shaft-hint").textContent =
    `${perPick.toFixed(2)} bytes per pick. Biggest file here is about ${formatSize(MAX_PICKS * perPick)}, more if it compresses.`;
}

// first picks only, warp repeated across like on the loom
function drawCloth(grid, canvas) {
  const shafts = grid[0].length;
  const ends = shafts * Math.ceil(64 / shafts); // ~64 ends wide whatever the shafts
  const picks = Math.min(grid.length, PREVIEW_PICKS);
  const cell = 5;
  canvas.width = ends * cell;
  canvas.height = picks * cell;
  const ctx = canvas.getContext("2d");

  for (let pick = 0; pick < picks; pick++) {
    for (let end = 0; end < ends; end++) {
      const x = end * cell, y = pick * cell;
      const warpUp = grid[pick][end % shafts];
      ctx.fillStyle = warpUp ? WARP : WEFT;
      ctx.fillRect(x, y, cell, cell);
      // gap between threads
      ctx.fillStyle = "rgba(0,0,0,.12)";
      if (warpUp) ctx.fillRect(x + cell - 1, y, 1, cell);
      else ctx.fillRect(x, y + cell - 1, cell, 1);
    }
  }
}

async function weaveFile(file) {
  const info = $("weave-info");
  const shafts = Number($("shafts").value);
  info.classList.remove("error");
  $("save-wif").hidden = true;
  $("cloth").removeAttribute("width"); // hides old preview

  if (file.size > MAX_READ) {
    const max = formatSize(MAX_PICKS * bytesPerPick(shafts));
    return showError(info, `${file.name} is ${formatSize(file.size)}, way past the limit. Max is about ${max} at ${shafts} shafts.`);
  }
  info.textContent = "weaving...";

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { wif, grid } = await fileToWif(bytes, file.name, shafts, MAX_PICKS);
    const hash = toHex(await crypto.subtle.digest("SHA-256", bytes));

    drawCloth(grid, $("cloth"));
    const preview = grid.length > PREVIEW_PICKS ? ` (preview shows the first ${PREVIEW_PICKS})` : "";
    info.textContent =
      `${file.name}, ${formatSize(bytes.length)}\n` +
      `${grid.length.toLocaleString()} picks on ${shafts} shafts${preview}\n` +
      `about ${formatLength(grid.length)} of cloth, longest float ${longestFloat(grid)}\n` +
      `draft is ${formatSize(wif.length)}\n` +
      `sha256 ${hash}`;

    $("save-wif").hidden = false;
    $("save-wif").onclick = () => download(wif, `${file.name}.wif`, "text/plain");
  } catch (err) {
    const tip = /too big/.test(err.message) ? "\nTry more shafts or a smaller file." : "";
    showError(info, err.message + tip);
  }
}

$("file-in").addEventListener("change", (e) => {
  lastFile = e.target.files[0] ?? null;
  if (lastFile) weaveFile(lastFile);
});

$("shafts").addEventListener("change", () => {
  showShaftHint();
  if (lastFile) weaveFile(lastFile);
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
    info.textContent = `got ${name} back, ${formatSize(data.length)}\nsha256 ${toHex(hash)}`;
    $("save-file").hidden = false;
    $("save-file").onclick = () => download(data, name, "application/octet-stream"); // name already stripped
  } catch (err) {
    showError(info, err.message);
  }
});

showShaftHint();