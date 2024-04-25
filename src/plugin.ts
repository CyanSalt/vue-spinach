import type { MemberExpression, Node } from '@babel/types'
import type { MagicStringAST } from 'magic-string-ast'

export interface BaseNode {
  type: string,
}

export interface Code extends BaseNode {
  type: 'Code',
  content: string,
  once: boolean,
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
  exposed: boolean,
}

export interface Replacement extends BaseNode {
  type: 'Replacement',
  content: string,
}

export type TransformNode = Code | Import | ThisProperty

export type VisitNode = Code | Import | Replacement

export const factory = {
  code: (content: string, once = false): Code => ({ type: 'Code', content, once }),
  imports: (from: string, imported: string): Import => ({ type: 'Import', from, imported }),
  thisProperty: (name: string, source: string, exposed = true): ThisProperty => ({ type: 'ThisProperty', name, source, exposed }),
  replace: (content: string): Replacement => ({ type: 'Replacement', content }),
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

export function defineSpinachPlugin(plugin: Plugin) {
  return plugin
}
