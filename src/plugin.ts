import type { MemberExpression, Node } from '@babel/types'
import type { MagicStringAST } from 'magic-string-ast'

export const CodePriority = {
  gap: 1,
  // components, directives
  dependency: -2,
  // props, emits, inject
  interface: -1,
  // setup, data
  // state: 0,
  // computed, methods
  derived: 1,
  // watch, lifecycles
  effect: 2,
} as const

export interface BaseNode {
  type: string,
}

export interface Code extends BaseNode {
  type: 'Code',
  content: string,
  priority: number,
}

export interface HoistedCode extends BaseNode {
  type: 'HoistedCode',
  content: string,
  priority: number,
}

export interface Property extends BaseNode {
  type: 'Property',
  name: string,
  source: unknown,
  exposed: boolean,
}

export interface Replacement extends BaseNode {
  type: 'Replacement',
  content: string | false,
}

export type TransformNode = Code | HoistedCode | Replacement | Property

export type VisitNode = Code | HoistedCode | Replacement

export const factory = {
  priority: CodePriority,
  code: (content: string, priority = 0): Code => ({
    type: 'Code',
    content,
    priority,
  }),
  hoist: (content: string, priority = 0): HoistedCode => ({
    type: 'HoistedCode',
    content,
    priority,
  }),
  property: (name: string, source: unknown, exposed = true): Property => ({
    type: 'Property',
    name,
    source,
    exposed,
  }),
  replace: (content: string | false): Replacement => ({
    type: 'Replacement',
    content,
  }),
}

export interface TransformOptions {
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
  name: string,
  node: MemberExpression,
  magicString: MagicStringAST,
  source: unknown,
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

export function defineSpinachPlugin(plugin: Plugin) {
  return plugin
}
