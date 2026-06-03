// Offline, one-time: download the public GrooVAE (groovae_2bar_humanize) tfjs
// checkpoint, fp16-pack its weights, and emit public/models/groovae/{weights.bin,meta.json}.
// Pure Node (built-in fetch/fs) — NO tensorflow, NO magenta, NO deps.
//
//   node scripts/prep-groovae-weights.mjs
//
// The output is committed and lazy-fetched at runtime by src/utils/grooveWeights.js.

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const BASE =
  'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/groovae_2bar_humanize/'
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'groovae')

// IEEE-754 float32 -> float16 (round to nearest even). Returns a uint16.
// Exported so the round-trip against grooveWeights.f16ToF32 can be unit-tested.
export function f32ToF16(val) {
  const f32 = new Float32Array(1)
  const i32 = new Int32Array(f32.buffer)
  f32[0] = val
  const x = i32[0]
  const sign = (x >> 16) & 0x8000
  let mant = x & 0x007fffff
  let exp = (x >> 23) & 0xff
  if (exp === 0xff) {
    // Inf / NaN
    return sign | 0x7c00 | (mant ? 0x0200 : 0)
  }
  exp = exp - 127 + 15
  if (exp >= 0x1f) return sign | 0x7c00 // overflow -> Inf
  if (exp <= 0) {
    // subnormal / underflow
    if (exp < -10) return sign
    mant |= 0x00800000
    const shift = 14 - exp
    const half = mant >> shift
    const rem = mant & ((1 << shift) - 1)
    const halfway = 1 << (shift - 1)
    let out = half
    if (rem > halfway || (rem === halfway && (half & 1))) out += 1
    return sign | out
  }
  let half = (exp << 10) | (mant >> 13)
  const rem = mant & 0x1fff
  if (rem > 0x1000 || (rem === 0x1000 && (half & 1))) half += 1 // round to nearest even
  return sign | half
}

async function fetchBuf(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

async function main() {
  console.log('Fetching manifest ...')
  const manifest = await (await fetch(BASE + 'weights_manifest.json')).json()
  const group = manifest[0]

  console.log(`Fetching ${group.paths.length} shards ...`)
  const shards = await Promise.all(group.paths.map((p) => fetchBuf(BASE + p)))
  const blob = Buffer.concat(shards)
  console.log(`Concatenated ${blob.length} bytes (${(blob.length / 1048576).toFixed(1)} MB f32)`)

  const meta = { numSteps: 32, dtype: 'fp16', weights: {} }
  const out = [] // uint16 values
  let f32Offset = 0 // byte offset into blob
  for (const w of group.weights) {
    if (w.dtype !== 'float32') throw new Error(`unexpected dtype ${w.dtype} for ${w.name}`)
    const n = w.shape.reduce((a, b) => a * b, 1)
    const elOffset = out.length
    for (let i = 0; i < n; i++) {
      out.push(f32ToF16(blob.readFloatLE(f32Offset + i * 4)))
    }
    f32Offset += n * 4
    meta.weights[w.name] = { offset: elOffset, shape: w.shape }
  }
  if (f32Offset !== blob.length) {
    console.warn(`WARN: consumed ${f32Offset} of ${blob.length} bytes`)
  }

  const u16 = Uint16Array.from(out)
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(join(OUT_DIR, 'weights.bin'), Buffer.from(u16.buffer))
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta))
  console.log(
    `Wrote ${OUT_DIR}/weights.bin (${(u16.byteLength / 1048576).toFixed(1)} MB fp16), ` +
      `meta.json (${Object.keys(meta.weights).length} weights)`,
  )
}

// Run only when invoked directly (`node scripts/prep-groovae-weights.mjs`), so
// importing this module for tests doesn't kick off the download.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
