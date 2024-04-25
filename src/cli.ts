import * as fs from 'node:fs'
import parseArgs from 'minimist'
import type { TransformOptions } from '.'
import { transformSFC } from '.'

async function read(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const args = parseArgs<{
    print?: boolean,
    out?: string,
    config?: string,
  }>(process.argv.slice(2))
  const inputFile = args._[0]
  const inputPromise = inputFile
    ? fs.promises.readFile(inputFile, 'utf8')
    : read(process.stdin)
  let config: TransformOptions | undefined
  if (args.config) {
    const { default: importedConfig } = await import(args.config)
    config = importedConfig
  }
  const input = await inputPromise
  const output = transformSFC(input, config)
  const outFile = args.print ? undefined : (args.out ?? inputFile)
  if (outFile) {
    await fs.promises.writeFile(outFile, output)
  } else {
    process.stdout.write(output + '\n')
  }
}

main()
