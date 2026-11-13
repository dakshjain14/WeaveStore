# WeaveStore

Store any file in a piece of cloth.

WeaveStore turns a file into a weaving draft (`.wif`), the plain text format weavers use to share patterns. The draft describes real cloth that a loom could weave. Load the draft back in and you get the exact same bytes out.

**Try it:** https://dakshjain14.github.io/WeaveStore/

Made for the Weird Storage card in Hack Club Crescent.

## Quick start

### In the browser

1. Open the link above.
2. Pick any file under "File to draft" and download the `.wif`.
3. Drop the `.wif` into "Draft to file" and download your file again. The SHA-256 shown on both sides should match.

Everything runs in your browser. Nothing gets uploaded.

Want to try the decoding first? `examples/hello.txt.wif` has a short text file woven into it. Drop it into "Draft to file".

### From the command line

You need Node 22 or newer. No `npm install`, there are no dependencies.

```
git clone https://github.com/dakshjain14/WeaveStore
cd WeaveStore
node cli/roundtrip.js path/to/file [shafts]
```

This writes `file.wif` next to the original, reads it back from disk into `recovered/`, and prints both hashes. Shafts default to 16.

### Running the page locally

```
python -m http.server
```

Then open http://localhost:8000. Double clicking `index.html` won't work, browsers block JS modules on `file://`.

## Results

Every one of these came back with the same SHA-256, and the longest float was 4 in all of them.

| File | Size | Shafts | Picks | Cloth (10 picks/cm) |
|---|---|---|---|---|
| hello.txt | 23 bytes | 16 | 40 | ~4 cm |
| empty zip | 22 bytes | 16 | 44 | ~4 cm |
| test.zip | 427 bytes | 16 | 276 | ~28 cm |
| OIP-1134548834.jpg | 11,704 bytes | 16 | 8,192 | ~8.2 m |
| OIP-1134548834.jpg | 11,704 bytes | 8 | 16,380 | ~16.4 m |

Hashes, before and after:

```
hello.txt   c601cdc55316f5b955554d5e620f383b7546c05fe6801a113af9485115be4c3d
empty zip   8739c76e681f900923b900c9df0ef75cf421d39cabb54650c4b9ad19b6a76d85
test.zip    862af939e336b73f6ecfeeb1961337b270ae85895e4eb52000bd0d0c5b7c7d93
the jpg     d22e8f7da52a46c7c971e2724041df7a89a7c824366e656cfe29a81cf9cee7dc
```

Biggest file so far: the 11.7 KB JPG, which is about 8 metres of cloth.

## How it works

The short version:

```
file -> header -> blocks -> cloth -> .wif
.wif -> cloth -> blocks -> header check -> file
```

### Some weaving words first

- **Warp**: the threads running lengthways, set up on the loom first.
- **Weft**: the thread going across, over and under the warp.
- **Pick**: one pass of the weft, so one row of the cloth.
- **Shaft**: a frame that lifts a group of warp threads together. More shafts means more threads you can move on their own.
- **Float**: a thread skipping over several others. Long floats snag and make the cloth loose, so weavers avoid them.
- **Liftplan**: the list of which shafts go up on each pick.

### 1. The header

Before anything gets woven, the file is wrapped in a 19 byte header:

| Bytes | What |
|---|---|
| 0-3 | `WVST`, so we know it's one of ours |
| 4 | version (1) |
| 5 | flags, bit 0 = compressed |
| 6 | filename length |
| 7-10 | payload length, big endian |
| 11-18 | first 8 bytes of the file's SHA-256 |

Then the filename (UTF-8, max 255 bytes), then the payload.

The file gets compressed with deflate, but only if that actually makes it smaller. Text shrinks a lot. JPGs and zips are already compressed, so they usually go in as they are. The hash is taken from the original file, not the compressed one, so a match at the end means the original bytes came back.

Folders are stripped from the name when packing and again when unpacking. A draft with a name like `../../evil` can't write outside the folder you save to.

### 2. Blocks

Think of the cloth as a grid. Each cell is 1 if the warp is on top there, and 0 if the weft is.

If the data went straight into that grid, you'd get things like a whole row of 1s, which is one thread floating across the whole cloth. So instead the grid is cut into 4x4 blocks, and only some blocks are allowed: ones where no row and no column has 3 of the same value in a row.

Allowed:

```
1 0 1 1
0 1 0 0
1 1 0 1
0 0 1 0
```

Not allowed, the top row has three 1s in a row:

```
1 1 1 0
0 1 0 0
1 0 0 1
0 1 1 0
```

There are 65,536 possible 4x4 blocks. Checking all of them leaves 2,030 that are allowed.

Inside a block the longest run is 2. A float that crosses the edge between two blocks can take at most 2 cells from each side, so **no float anywhere in the cloth is longer than 4**. That holds across, down, and where the warp repeats. It's the same idea as the run length limited (RLL) codes old hard drives used, just for thread instead of magnetism.

The page and the CLI both work out the longest float for every draft and show it.

### 3. Bytes to blocks

4 bytes make a number from 0 to 4,294,967,295 (2^32 - 1).

With 2,030 blocks to choose from, 3 blocks can make 2030^3 = 8,365,427,000 different combos, which is more than 2^32. So the number gets written in base 2030 with 3 digits, smallest digit first, and each digit picks one block from the list.

So 3 blocks hold 4 bytes, which works out to 10.67 bits per block. The most a block could ever hold is log2(2030) = 10.99 bits, so very little is wasted.

Bonus: about half of all 3 block combos turn into numbers bigger than 2^32. Those can't come from real data, so if the reader finds one, it knows the draft got damaged somewhere.

The last few bytes get padded with zeros to make a whole group of 4. The header knows the real length, so the padding is cut off at the end.

### 4. Blocks to cloth

The warp is threaded in a straight draw: end 1 on shaft 1, end 2 on shaft 2, and so on up to the last shaft, then it starts again. The draft has 4 of those repeats, so 64 warp ends on 16 shafts.

Blocks go in left to right, `shafts / 4` blocks across. Every 4 picks makes one band. If the last band isn't full, it's filled with filler blocks, which decode to zeros and get cut off like the padding.

How much fits:

| Shafts | Blocks across | Bytes per pick |
|---|---|---|
| 4 | 1 | 0.33 |
| 8 | 2 | 0.67 |
| 16 | 4 | 1.33 |
| 24 | 6 | 2 |

Files that compress well can beat these numbers. The JPG got 1.43 bytes per pick on 16 shafts because deflate squeezed a bit out of it. Tiny files come in under them, since the 19 byte header, the filename and the padding take up a big share. hello.txt only got 0.57.

### 5. The .wif file

WIF is an old INI style format from the 90s that a lot of weaving software can read. WeaveStore writes these sections:

- `[WEAVING]`: number of shafts, rising shed
- `[WARP]` and `[WEFT]`: thread counts and colours
- `[THREADING]`: the straight draw, like `1=1`, `2=2`...
- `[LIFTPLAN]`: one line per pick listing the shafts that go up, like `1=1,3,4,6,9,10,12,15`

The data lives only in the liftplan. Nothing is hidden in notes or comments. Delete the liftplan and the file is gone.

### 6. Getting the file back

Reading a draft does all of the above backwards:

1. Parse the INI sections.
2. Rebuild the cloth from the liftplan and threading. If weaving software re-saved the draft with a tie-up and treadling instead of a liftplan, it uses those. Sinking shed drafts get flipped.
3. Read the first `shafts` warp ends of each pick. The rest are repeats.
4. Cut the cloth into 4x4 blocks and look each one up. A block that isn't in the list means the draft is damaged.
5. Turn each group of 3 blocks back into 4 bytes.
6. Check the header: magic, version, length. Decompress if the flag is set.
7. Hash the result and compare it with the 8 bytes stored in the header.

If anything doesn't line up, you get an error saying what went wrong instead of a broken file.

## Files

```
index.html          the page
style.css           how it looks
app.js              page logic: file picker, cloth preview, downloads
lib/
  blocks.js         finds the 2,030 allowed blocks, 4 bytes <-> 3 blocks
  header.js         adds and checks the header, compression, filename cleanup
  cloth.js          lays blocks out into picks and back, float checker
  wif.js            writes .wif text, reads it back (liftplan or treadling)
  index.js          joins it all up: fileToWif() and wifToFile()
cli/
  roundtrip.js      command line: file -> .wif -> file, prints hashes
examples/
  hello.txt         a small file
  hello.txt.wif     the same file as a draft
```

How they connect:

```
app.js / cli/roundtrip.js
        |
     lib/index.js
     /    |     \
header  cloth   wif
          |
       blocks
```

`lib/` has no DOM code, so the same files run in the browser and in Node.

## Limits

Any file type works. WeaveStore only sees bytes, so photos, zips, PDFs and empty files all come back the same.

Size is the catch. Each pick only holds a byte or so:

| Shafts | Biggest file on the web page |
|---|---|
| 4 | ~330 KB |
| 8 | ~650 KB |
| 16 | ~1.3 MB |
| 24 | ~2 MB |

The page stops at 1,000,000 picks so the browser doesn't run out of memory. The header format itself goes up to 4 GB.

Realistically, anything over a few hundred bytes is something you'd keep as a draft rather than weave. 1 MB at 16 shafts is around 750 metres of cloth.

## What's next

- Weave hello.txt for real. It's 40 picks, about 4 cm, on any 16 shaft loom.
- Read the file back from a photo of the cloth. That needs error correction (Reed-Solomon) since photos are messy.
- Pack more in. The float rule allows a lot more than 4x4 blocks use.