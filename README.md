# WeaveStore

Store any file in a piece of cloth.

WeaveStore turns a file into a weaving draft (`.wif`), which is the format weavers use to share patterns. The draft is real cloth that a loom could actually weave, and no thread in it floats over more than 4 others, so it holds together. Load the draft back in and you get the exact same bytes out.

**Try it:** https://dakshjain14.github.io/WeaveStore/

The fun part is the maths underneath. It's basically one question: how much data can you fit in a grid of 0s and 1s if no row or column is allowed long runs? Most of this README is about that.

- [Quick start](#quick-start)
- [Some weaving words](#some-weaving-words)
- [The maths](#the-maths)
- [How a file goes through](#how-a-file-goes-through)
- [Files](#files)
- [Results](#results)
- [Limits](#limits)

## Quick start

On the web page, pick any file under "File to draft" and download the `.wif`. Then drop that `.wif` into "Draft to file" and you get your file back. The SHA-256 shown on both sides should match. It all runs in your browser, nothing gets uploaded.

Want to try the decoding side first? Drop `examples/hello.txt.wif` in. It should give you back a text file that says "Hello from the loom!".

From the command line (Node 22 or newer, no dependencies):

```
git clone https://github.com/dakshjain14/WeaveStore
cd WeaveStore
node cli/roundtrip.js path/to/file [shafts]
```

That writes `file.wif` next to your file, reads it back from disk into `recovered/` and prints both hashes. Shafts default to 16.

To run the page locally, use `python -m http.server` and open http://localhost:8000. Double clicking `index.html` won't work, browsers block JS modules on `file://`.

## Some weaving words

Cloth is a grid. The lengthways threads are the **warp**, and the thread going across is the **weft**. Each cell is 1 if the warp is on top there and 0 if the weft is. One row is a **pick**.

Warp threads are tied onto **shafts**, frames that lift together. So the number of shafts is how many columns you actually control. The **liftplan** says which shafts go up on each pick.

A **float** is a thread skipping over several others, which is just a run of equal cells along a row or down a column. Long floats snag and make the cloth loose. So the rule for decent cloth is: no row or column has more than 4 equal cells in a row.

That's a 2D run length limited (RLL) constraint, the same kind of rule old hard drives used to keep their read heads in sync. Here it's thread instead of magnetism.

## The maths

### Counting the blocks

Solving the whole grid at once is hard, so I cut it into 4×4 blocks and only allow blocks where no row or column has a run longer than 2.

Start with one line of 4 cells. There are $2^4 = 16$ patterns, and 6 of them have a run of 3 or more (`0000 0001 1000 1111 1110 0111`), so 10 are fine. That's not a coincidence. Binary strings of length $n$ with no run over 2 always number $2F_{n+1}$, twice a Fibonacci number, and for $n = 4$ that's $2 \times 5 = 10$.

If only rows mattered you'd get $10^4 = 10{,}000$ blocks. But the columns have to pass too, which cuts it way down. Checking all $2^{16} = 65{,}536$ blocks leaves

$$|B| = 2030$$

so about 3% of all 4×4 patterns are allowed.

```
allowed      not allowed (three 1s on top)
1 0 1 1      1 1 1 0
0 1 0 0      0 1 0 0
1 1 0 1      1 0 0 1
0 0 1 0      0 1 1 0
```

### Why floats never go past 4

Claim: put allowed blocks next to each other however you like, and no row or column ever has a run of 5.

Block edges come every 4 cells. Any 5 cells in a row cross at most one edge, because crossing two needs a whole block in the middle plus a cell on each side, which is 6 cells. So the 5 cells split 1+4, 2+3, 3+2 or 4+1 between two blocks, and one of the blocks always gets at least 3 of them. If all 5 were the same, that block would have a run of 3, and allowed blocks never do. ∎

Columns work the same way, since picks come in bands of 4. The warp repeats across the loom every `shafts` threads, and shafts is always a multiple of 4, so the block edges still line up where one repeat meets the next.

And 4 really does happen. A row ending `..11` next to one starting `11..` gives exactly 4, so the bound is as tight as it can be.

### Fitting 4 bytes into 3 blocks

4 bytes is a number $v$ between $0$ and $2^{32} - 1$. Three blocks can be arranged $2030^3 = 8{,}365{,}427{,}000$ ways, which is more than $2^{32} = 4{,}294{,}967{,}296$, so it always fits. I write $v$ in base 2030:

$$v = d_0 + 2030\,d_1 + 2030^2\,d_2, \qquad 0 \le d_i < 2030$$

and each digit picks a block from the list. Decoding just goes backwards.

One block can hold at most $\log_2 2030 \approx 10.99$ bits, and this uses $32/3 \approx 10.67$, so

$$\frac{32/3}{\log_2 2030} \approx 97.1\%$$

The lazy way would be to only use 1024 blocks for a clean 10 bits each, but that only gets 91%.

### How close to the limit is it

Each block is 16 cells, so WeaveStore stores $\frac{32/3}{16} = \frac{2}{3} \approx 0.667$ bits per cell.

The most any code could ever store with "no run over 4", even in just one direction, is $\log_2 \lambda$, where $\lambda$ is the biggest root of

$$x^4 = x^3 + x^2 + x + 1$$

(the tetranacci version of the golden ratio). $\lambda \approx 1.9276$, so the limit is about 0.947 bits per cell. Limiting rows and columns at the same time pushes the real limit a bit lower.

So WeaveStore gets at least 70% of the maximum. The gap is the price of keeping it simple. Runs are capped at 2 inside a block so that any two blocks can sit next to each other without checking anything. A smarter encoder that looks at its neighbours could squeeze more in, but it'd be a lot harder to prove safe.

### Capacity

With $s$ shafts, every band of 4 picks holds $s/4$ blocks, so

$$\text{bytes per pick} = \frac{s}{4} \cdot \frac{4}{3} \cdot \frac{1}{4} = \frac{s}{12}$$

| Shafts | Bytes per pick |
|---|---|
| 4 | 0.33 |
| 8 | 0.67 |
| 16 | 1.33 |
| 24 | 2 |

For a packed file of $n$ bytes (header + name + data), the number of picks is

$$\text{picks} = 4 \left\lceil \frac{3 \lceil n/4 \rceil}{s/4} \right\rceil$$

Quick check with hello.txt on 16 shafts: $n = 19 + 9 + 23 = 51$, which is 13 words, 39 blocks, 10 bands, so 40 picks. The real run gave 40 :)

Tiny files come in under $s/12$ because the header takes a big chunk. Files that compress well beat it, since they get deflated first.

### Catching damage

When a draft gets read back there are three checks:

1. Every block has to be one of the 2030. A random 16-bit pattern only has a ~3% chance of being one, so a lot of junk dies here.
2. Every 3 blocks have to decode to something under $2^{32}$. About half of all 3-block combos don't, which is a free extra check that comes from the leftover space.
3. The first 8 bytes of the SHA-256 have to match. Something wrong slipping past this is around a 1 in $2^{64}$ shot.

The first two are cheap but they miss things, because a single wrong cell can easily turn one legal block into another legal block. The hash is the one that actually matters. These only spot errors though, they can't fix them.

## How a file goes through

```
file -> header -> blocks -> cloth -> .wif
.wif -> cloth -> blocks -> header check -> file
```

First the file gets a 19 byte header:

| Bytes | What |
|---|---|
| 0-3 | `WVST` |
| 4 | version (1) |
| 5 | flags, bit 0 = compressed |
| 6 | filename length |
| 7-10 | data length |
| 11-18 | first 8 bytes of the SHA-256 |

Then the filename, then the data. The data is only compressed if that makes it smaller, so text shrinks a lot but JPGs and zips go in as they are. The hash is taken from the original file, so if it matches at the end you know you got the real thing back. Folders get stripped from the name too, so a sketchy draft can't write files outside the folder you save to.

Then it goes into the cloth. The warp is threaded straight (thread 1 on shaft 1, thread 2 on shaft 2, and so on, then it repeats). Blocks go left to right, $s/4$ across, 4 picks per band, and any gap at the end gets filler blocks.

The data only lives in the `[LIFTPLAN]` part of the `.wif`, one line per pick listing the shafts that go up. Nothing is hidden in notes or comments. Delete the liftplan and the file is gone.

Reading it back does all of that in reverse. It also handles drafts that weaving software re-saved as tie-up + treadling instead of a liftplan, and sinking shed drafts, where everything is flipped.

## Files

```
index.html          the page
style.css           styling
app.js              page logic, preview, downloads
lib/
  blocks.js         the 2030 blocks, 4 bytes <-> 3 blocks
  header.js         header, compression, hash check
  cloth.js          blocks <-> picks, float checker
  wif.js            writes and reads .wif
  index.js          ties it together
cli/
  roundtrip.js      file -> .wif -> file, prints hashes
examples/
  hello.txt         small test file
  hello.txt.wif     same file as a draft
```

```
app.js / cli
     |
lib/index.js
 /    |    \
header cloth wif
       |
     blocks
```

Nothing in `lib/` is browser-only, so the same files run on the page and in Node.

## Results

Every one of these came back with the same SHA-256, and the longest float was 4 each time.

| File | Size | Shafts | Picks | Cloth (10 picks/cm) |
|---|---|---|---|---|
| hello.txt | 23 bytes | 16 | 40 | ~4 cm |
| empty zip | 22 bytes | 16 | 44 | ~4 cm |
| test.zip | 427 bytes | 16 | 276 | ~28 cm |
| photo (jpg) | 11,704 bytes | 16 | 8,192 | ~8.2 m |
| photo (jpg) | 11,704 bytes | 8 | 16,380 | ~16.4 m |

```
hello.txt   c601cdc55316f5b955554d5e620f383b7546c05fe6801a113af9485115be4c3d
empty zip   8739c76e681f900923b900c9df0ef75cf421d39cabb54650c4b9ad19b6a76d85
test.zip    862af939e336b73f6ecfeeb1961337b270ae85895e4eb52000bd0d0c5b7c7d93
photo       d22e8f7da52a46c7c971e2724041df7a89a7c824366e656cfe29a81cf9cee7dc
```

The biggest so far is the 11.7 KB photo, which works out to about 8 metres of cloth.

## Limits

Any file type works, since it only ever sees bytes. Size is the catch.

| Shafts | Biggest file on the page |
|---|---|
| 4 | ~330 KB |
| 8 | ~650 KB |
| 16 | ~1.3 MB |
| 24 | ~2 MB |

The page stops at 1,000,000 picks so your browser doesn't run out of memory. To be honest, anything past a few hundred bytes is a draft you keep, not one you'd weave. 1 MB on 16 shafts is about 750 m of cloth.

## What's next

- Actually weave hello.txt. It's 40 picks, about 4 cm.
- Read a file back from a photo of the cloth. Photos are noisy, so that needs real error correction (Reed-Solomon), not just detection.
- Get closer to the 0.947 limit with an encoder that looks at neighbouring blocks.