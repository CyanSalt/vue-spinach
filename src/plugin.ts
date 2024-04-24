import type { Node } from '@babel/types'
import type { MagicStringAST } from 'magic-string-ast'

export interface Plugin {
  filter: (name: string, property: Node) => boolean,
  transform: (node: Node, magicString: MagicStringAST) => Generator<string, void, unknown>,
}

export function defineSpinachPlugin(plugin: Plugin) {
  return plugin
}
