import type { Function, Node } from '@babel/types'
import { isFunctionType, isLiteralType, resolveString } from 'ast-kit'
import { definePlugin } from '../plugin'
import { getProperties } from '../transform'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'emits'
  },
  *transform({ node, options }, { factory, stringify }) {
    const standaloneEmits: Record<string, Node | true> = {}
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        standaloneEmits[key] = value
      }
    } else if (node.type === 'ArrayExpression') {
      for (const element of node.elements) {
        if (isLiteralType(element)) {
          const key = resolveString(element)
          standaloneEmits[key] = true
        }
      }
    }
    yield factory.property('$emit', 'emit', false)
    if (options.scriptSetup) {
      if (options.typescript) {
        let typings: string[] = []
        for (const [key, value] of Object.entries(standaloneEmits)) {
          if (value !== true && isFunctionType(value)) {
            // TODO: fill types
            const params = value.params.map((param: Function['params'][number]) => {
              return param['typeAnnotation'] ? stringify(param) : `${stringify(param)}?: unknown`
            })
            typings.push(`(event: '${key}', ${params.map(item => `${item}, `).join('')}...args: unknown[]): void`)
          } else {
            typings.push(`(event: '${key}', ...args: unknown[]): void`)
          }
        }
        yield factory.code(`const emit = defineEmits<{\n${typings.map(item => `  ${item},\n`).join('')}}>()`, factory.priority.interface)
      } else {
        yield factory.code(`const emit = defineEmits(${stringify(node)})`, factory.priority.interface)
      }
    } else {
      return false
    }
  },
  *visitProperty({ name, source, options }, { factory }) {
    if (name === '$emit') {
      if (source !== 'emit') {
        const defaultType = `(event: string, ...args: unknown[]) => void`
        yield factory.hoist(`const emit = defineEmits${options.typescript ? `<${defaultType}>` : ''}()`)
      }
      return 'emit'
    }
  },
})
