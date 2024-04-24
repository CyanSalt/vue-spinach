import type { Program } from '@babel/types'
import type { SFCScriptBlock } from '@vue/compiler-sfc'
import { babelParse } from 'ast-kit'
import { MagicStringAST } from 'magic-string-ast'

function createVirtualPosition() {
  return {
    offset: 0,
    line: 0,
    column: 0,
  }
}

export function createSourceLocation(code: string) {
  return {
    start: createVirtualPosition(),
    end: createVirtualPosition(),
    source: code,
  }
}

export interface Script {
  ast: Program,
  magicString: MagicStringAST,
  block: SFCScriptBlock,
}

export function parseScript(block: SFCScriptBlock | null): Script | undefined {
  if (!block) return undefined
  const ast = babelParse(block.content, block.lang, {
    plugins: [['importAttributes', { deprecatedAssertSyntax: true }]],
  })
  const magicString = new MagicStringAST(block.content)
  return {
    ast,
    magicString,
    block,
  }
}
