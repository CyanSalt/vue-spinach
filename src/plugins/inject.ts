import type { Node } from '@babel/types'
import { isLiteralType, resolveString } from 'ast-kit'
import { definePlugin } from '../plugin'
import { getProperties } from '../transform'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'inject'
  },
  *transform({ node, options }, { factory, stringify }) {
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
          injectFrom ? stringify(injectFrom) : `'${key}'`
        }${defaultValue ? `, ${stringify(defaultValue)}` : ''})`
        yield factory.property(key, 'inject')
        yield factory.code(`const ${key} = ${injectExpr}`, factory.priority.interface)
      }
    } else if (node.type === 'ArrayExpression') {
      for (const element of node.elements) {
        if (isLiteralType(element)) {
          hasInject = true
          const key = resolveString(element)
          const injectExpr = `inject('${key}')`
          yield factory.property(key, 'inject')
          yield factory.code(`const ${key} = ${injectExpr}`, factory.priority.interface)
        }
      }
    }
    if (hasInject) {
      yield factory.hoist(`import { inject } from 'vue'`)
    }
  },
  *visitProperty({ name, source }) {
    if (source === 'inject') {
      return name
    }
  },
})
