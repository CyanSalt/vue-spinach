import * as fs from 'node:fs'
import parseArgs from 'minimist'
import type { TransformSFCOptions } from '.'
import { transformSFC } from '.'

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const inputFile = args._[0]
  if (!inputFile) {
    console.error('Usage: vue-spinach <inFile> [--out outFile] [--config configFile]')
    process.exitCode = 1
  } else {
    const inputPromise = fs.promises.readFile(inputFile, 'utf8')
    let config: TransformSFCOptions | undefined
    if (args.config) {
      config = await import(args.config)
    }
    const input = await inputPromise
    const output = transformSFC(input, config)
    await fs.promises.writeFile(args.out ?? inputFile, output)
  }
}

main()
