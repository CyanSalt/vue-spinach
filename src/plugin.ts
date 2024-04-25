import type { MemberExpression, Node } from '@babel/types'
import type { MagicStringAST } from 'magic-string-ast'

export interface BaseNode {
  type: string,
}

export interface Code extends BaseNode {
  type: 'Code',
  content: string,
}

export interface Import extends BaseNode {
  type: 'Import',
  from: string,
  imported: string,
}

export interface ThisProperty extends BaseNode {
  type: 'ThisProperty',
  name: string,
  source: string,
}

export type TransformNode = Code | Import | ThisProperty

export type VisitNode = Code | Import

export const factory = {
  code: (content: string): Code => ({ type: 'Code', content }),
  imports: (from: string, imported: string): Import => ({ type: 'Import', from, imported }),
  thisProperty: (name: string, source: string): ThisProperty => ({ type: 'ThisProperty', name, source }),
}

export interface TransformOptions {
  scriptSetup: boolean,
  reactivityTransform: boolean,
}

export interface TransformContext {
  name: string,
  node: Node,
  magicString: MagicStringAST,
  options: TransformOptions,
}

export interface VisitContext {
  name: string,
  node: MemberExpression,
  magicString: MagicStringAST,
  source: string | undefined,
}

export interface TransformHelpers {
  factory: typeof factory,
  transform: (node: Node) => ReturnType<NonNullable<Plugin['transform']>>,
}

export interface VisitHelpers {
  factory: typeof factory,
}

export interface Plugin {
  transformInclude?: (context: TransformContext) => boolean,
  transform?: (context: TransformContext, helpers: TransformHelpers) => Generator<
    TransformNode,
    void,
    unknown
  >,
  visitProperty?: (context: VisitContext, helpers: VisitHelpers) => Generator<
    VisitNode,
    void,
    unknown
  >,
}

export function defineSpinachPlugin<T extends Plugin>(plugin: T) {
  return plugin
}
