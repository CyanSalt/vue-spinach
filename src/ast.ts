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
}

export function parseScript(code: string, lang?: string): Script {
  const ast = babelParse(code, lang, {
    plugins: [['importAttributes', { deprecatedAssertSyntax: true }]],
  })
  const magicString = new MagicStringAST(code)
  return {
    ast,
    magicString,
  }
}

export interface VueScript extends Script {
  block: SFCBlock,
}

export function parseVueScript(block: SFCBlock | null): VueScript | undefined {
  if (!block) return undefined
  return {
    ...parseScript(block.content, block.lang),
    block,
  }
}

export interface Fragment<T extends Node = Node> {
  node: T,
  magicString: MagicStringAST,
}

export function visitNode(node: Node, path: Node[], fn: (node: Node, path: Node[]) => void) {
  fn(node, path)
  const keys = VISITOR_KEYS[node.type] ?? []
  for (const key of keys) {
    const children = node[key]
    if (Array.isArray(children)) {
      children.forEach(child => {
        visitNode(child, [...path, node], fn)
      })
    } else if (children) {
      visitNode(children, [...path, node], fn)
    }
  }
}
