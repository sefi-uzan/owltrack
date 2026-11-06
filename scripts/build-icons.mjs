// Rasterises assets/icon.svg into the PNG/ICO files Electron and electron-builder need.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const svg = readFileSync('assets/icon.svg', 'utf8')
const render = (size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()

mkdirSync('build', { recursive: true })
mkdirSync('resources', { recursive: true })

writeFileSync('build/icon.png', render(512))
writeFileSync('resources/tray.png', render(32))
writeFileSync('build/icon.ico', await pngToIco([16, 24, 32, 48, 64, 128, 256].map(render)))
console.log('icons written: build/icon.png, build/icon.ico, resources/tray.png')
