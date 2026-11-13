// WeaveStore - header
// wraps the file before it goes into blocks, magic, name, length, hash
// deflates if it helps, unpack checks all of it on the way out
// file <-> blob with a header in front
// 0-3   "WVST"
// 4     version
// 5     flags, bit 0 = deflated
// 6     name length
// 7-10  payload length
// 11-18 first 8 bytes of sha256
// then name, then payload

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const MAGIC = encoder.encode("WVST");
const VERSION = 1;
const DEFLATED = 1;
export const HEADER_SIZE = 19;

async function sha256(bytes) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

//bytes through a compression or decompression stream
async function runStream(bytes, stream) {
    const piped = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(piped).arrayBuffer());
}

function baseName(name) {
    const base = name.split(/[\\/]/).pop();
    return base && base !== "." && base !== ".." ? base : "file";
}

//max 255 bytes, doesnt cut emojis in half, just truncates
function nameBytes(name) {
    const chars = [...baseName(name)];
    let bytes = encoder.encode(chars.join(""));
    while (bytes.length > 255) {
        chars.pop();
        bytes = encoder.encode(chars.join(""));
    }
    return bytes;
}

export async function pack(fileBytes, fileName) {
    const hash = await sha256(fileBytes); // For original not deflated, so we can check it after decompression
    const name = nameBytes(fileName);

    //only keeps compressed if smaller
    let payload = fileBytes;
    let flags = 0;
    const squashed = await runStream(fileBytes, new CompressionStream("deflate-raw"));
    if (squashed.length < fileBytes.length) {
        payload = squashed;
        flags |= DEFLATED;
    }

    const blob = new Uint8Array(HEADER_SIZE + name.length + payload.length);
    const view = new DataView(blob.buffer);
    blob.set(MAGIC, 0);
    blob[4] = VERSION;
    blob[5] = flags;
    blob[6] = name.length;
    view.setUint32(7, payload.length);
    blob.set(hash.slice(0, 8), 11);
    blob.set(name, HEADER_SIZE);
    blob.set(payload, HEADER_SIZE + name.length);
    return blob;
}   

//padding on the end is ok, we just slice it off before checking the hash
export async function unpack(blob) {
  if (blob.length < HEADER_SIZE || !MAGIC.every((b, i) => blob[i] === b))
    throw new Error("not a WeaveStore draft");
  if (blob[4] !== VERSION) throw new Error(`unknown version ${blob[4]}`);

  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const flags = blob[5];
  const nameLength = blob[6];
  const payloadLength = view.getUint32(7);
  const start = HEADER_SIZE + nameLength;

  if (blob.length < start + payloadLength) throw new Error("file got cut off");

  // strip folders again, never trust the draft
  const name = baseName(decoder.decode(blob.subarray(HEADER_SIZE, start)));
  const payload = blob.slice(start, start + payloadLength);

  let data = payload;
  if (flags & DEFLATED) {
    try {
      data = await runStream(payload, new DecompressionStream("deflate-raw"));
    } catch {
      throw new Error("couldn't decompress, draft damaged?");
    }
  }

  const hash = await sha256(data);
  if (!hash.subarray(0, 8).every((b, i) => b === blob[11 + i])) throw new Error("hash mismatch");
  return { name, data, hash };
}