import type { Node, Program } from '@babel/types'
import { VISITOR_KEYS } from '@babel/types'
import type { SFCBlock } from '@vue/compiler-sfc'
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
  block: SFCBlock,
}

export function parseScript(block: SFCBlock | null): Script | undefined {
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

export function visitNode(current: Node, fn: (node: Node) => void) {
  fn(current)
  const keys = VISITOR_KEYS[current.type] ?? []
  for (const key of keys) {
    const children = current[key]
    if (Array.isArray(children)) {
      children.forEach(child => {
        visitNode(child, fn)
      })
    } else if (children) {
      visitNode(children, fn)
    }
  }
}
