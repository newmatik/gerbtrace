import fs from 'node:fs'
import JSZip from 'jszip'
import { parseGerber } from '../lib/gerber/index'
import { plotImageTree } from '../lib/gerber/plotter'

async function main() {
  const zipPath = './public/samples/arduino-uno-rev3e.zip'
  const buf = fs.readFileSync(zipPath)
  const zip = await JSZip.loadAsync(buf)

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const content = await entry.async('text')
    const fileName = name.includes('/') ? name.split('/').pop()! : name
    console.log(`\n--- ${fileName} (${content.length} bytes) ---`)

    try {
      const ast = parseGerber(content)
      console.log(`  Filetype: ${ast.filetype}`)
      console.log(`  AST nodes: ${ast.children.length}`)

      const tree = plotImageTree(ast)
      console.log(`  Units: ${tree.units}`)
      console.log(`  Bounds: [${tree.bounds.map(n => n.toFixed(4)).join(', ')}]`)
      console.log(`  Graphics: ${tree.children.length}`)
    } catch (e: any) {
      console.error(`  ERROR: ${e.message}`)
    }
  }
}

main()
