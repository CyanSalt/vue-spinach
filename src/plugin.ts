import type { MemberExpression, Node } from '@babel/types'
import type { MagicStringAST } from 'magic-string-ast'

const CodePriority = {
  // props, emits, inject
  interface: -1,
  // setup, data
  state: 0,
  // computed, methods
  derived: 1,
  // watch, lifecycles
  effect: 2,
} as const

export interface BaseNode {
  type: string,
}

export interface LocalCode extends BaseNode {
  type: 'LocalCode',
  content: string,
  priority: number,
}

export interface HoistedCode extends BaseNode {
  type: 'HoistedCode',
  content: string,
}

export interface Property extends BaseNode {
  type: 'Property',
  name: string,
  // - `undefined` if no plugin transform this property
  // - `Plugin` if a plugin visit and replace this property implicitly
  source: unknown,
  exposed: boolean,
}

export type TransformNode = LocalCode | HoistedCode | Property

export type VisitNode = LocalCode | HoistedCode

export const factory = {
  priority: CodePriority,
  code: (content: string, priority = 0): LocalCode => ({
    type: 'LocalCode',
    content,
    priority,
  }),
  hoist: (content: string): HoistedCode => ({
    type: 'HoistedCode',
    content,
  }),
  property: (name: string, source: unknown, exposed = true): Property => ({
    type: 'Property',
    name,
    source,
    exposed,
  }),
}

export interface TransformOptions {
  /**
   * Always generate code in typescript
   * @default false
   */
  typescript: boolean,
  /**
   * Whether to generate <script setup> block.
   * @default true
   */
  scriptSetup: boolean,
  /**
   * Whether to generate code using [Reactivity Transform]{@link https://vue-macros.dev/features/reactivity-transform.html}.
   * @default false
   */
  reactivityTransform: boolean,
  /**
   * Whether to destructure props defined by `defineProps`.
   * Only valid when `scriptSetup` is `true`.
   * @default true
   */
  propsDestructure: boolean,
  /**
   * Specifies a mapping of import names.
   * For example `{ 'vue-router': 'vue-router-v4' }`.
   * @default {}
   */
  aliases: Record<string, string>,
  /**
   * Specifies additional plugins.
   * Plugins that transform Vue's built-in options are always enabled.
   * @default [...builtinPlugins]
   */
  plugins: Plugin[],
}

export interface TransformContext {
  name: string,
  node: Node,
  magicString: MagicStringAST,
  options: TransformOptions,
}

export interface VisitContext {
  name: string | undefined,
  node: MemberExpression,
  magicString: MagicStringAST,
  path: Node[],
  source: unknown,
  options: TransformOptions,
}

export interface StringifyFunction {
  (node: Node | Node[], indentation?: number): string,
  fn(node: Node, name?: string, indentation?: number): string,
}

export type IterateFunction = (node: Node | Node[], fn: (node: Node, path: Node[]) => void) => void

export interface TransformHelpers {
  factory: typeof factory,
  stringify: StringifyFunction,
  iterate: IterateFunction,
  transform: (node: Node) => ReturnType<NonNullable<Plugin['transform']>>,
}

export interface VisitHelpers {
  factory: typeof factory,
  stringify: StringifyFunction,
  iterate: IterateFunction,
}

export interface Plugin {
  transformInclude?: (context: TransformContext) => boolean,
  transform?: (context: TransformContext, helpers: TransformHelpers) => Generator<
    TransformNode,
    void | false,
    unknown
  >,
  visitProperty?: (context: VisitContext, helpers: VisitHelpers) => Generator<
    VisitNode,
    void | string,
    unknown
  >,
}

export function definePlugin(plugin: Plugin) {
  return plugin
}
