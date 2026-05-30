import sharp from 'sharp'
import { readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'

const PUBLIC_DIR = path.resolve('public')
const FILES = ['hero-art.png', 'corner-art-1.png', 'corner-art-2.png', 'corner-art-3.png']

const fmt = (n) => `${(n / 1024).toFixed(1)} KB`

for (const file of FILES) {
  const full = path.join(PUBLIC_DIR, file)
  const before = (await stat(full)).size
  const input = await readFile(full)

  const meta = await sharp(input).metadata()
  const maxDim = file.startsWith('hero') ? 800 : 320

  const out = await sharp(input)
    .resize({
      width: meta.width && meta.width > maxDim ? maxDim : meta.width,
      height: meta.height && meta.height > maxDim ? maxDim : meta.height,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ palette: true, quality: 80, compressionLevel: 9, effort: 10 })
    .toBuffer()

  await writeFile(full, out)
  const after = (await stat(full)).size
  console.log(`${file}: ${fmt(before)} -> ${fmt(after)} (${Math.round((1 - after / before) * 100)}% smaller)`)
}
