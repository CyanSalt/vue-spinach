import type { Node } from '@babel/types'
import { isLiteralType, resolveString } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'inject'
  },
  *transform({ node, magicString, options }, { factory }) {
    let hasInject = false
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        let injectFrom: Node | undefined
        let defaultValue: Node | undefined
        if (value.type === 'ObjectExpression') {
          const injectionProperties = getProperties(value)
          injectFrom = injectionProperties.from
          defaultValue = injectionProperties.default
        }
        hasInject = true
        const injectExpr = `inject(${
          injectFrom ? magicString.sliceNode(injectFrom) : `'${key}'`
        }${defaultValue ? `, ${magicString.sliceNode(defaultValue)}` : ''})`
        if (options.reactivityTransform) {
          yield factory.thisProperty(key, 'inject (reactivityTransform)')
          yield factory.code(`let ${key} = $(${injectExpr})`, factory.priority.interface)
        } else {
          yield factory.thisProperty(key, 'inject')
          yield factory.code(`const ${key} = ${injectExpr}`, factory.priority.interface)
        }
      }
    } else if (node.type === 'ArrayExpression') {
      for (const element of node.elements) {
        if (isLiteralType(element)) {
          hasInject = true
          const key = resolveString(element)
          const injectExpr = `inject('${key}')`
          if (options.reactivityTransform) {
            yield factory.thisProperty(key, 'inject (reactivityTransform)')
            yield factory.code(`let ${key} = $(${injectExpr})`, factory.priority.interface)
          } else {
            yield factory.thisProperty(key, 'inject')
            yield factory.code(`const ${key} = ${injectExpr}`, factory.priority.interface)
          }
        }
      }
    }
    if (hasInject) {
      yield factory.imports('vue', 'inject')
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (source === 'inject') {
      yield factory.replace(`${name}.value`)
    } else if (source === 'inject (reactivityTransform)') {
      yield factory.replace(name)
    }
  },
})