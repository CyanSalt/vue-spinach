import { isLiteralType, resolveString } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'expose'
  },
  *transform({ node, options }, { factory }) {
    let exposedProperties: string[] = []
    if (node.type === 'ArrayExpression') {
      for (const element of node.elements) {
        if (isLiteralType(element)) {
          const key = resolveString(element)
          exposedProperties.push(key)
        }
      }
    }
    if (exposedProperties.length) {
      const funcName = options.scriptSetup ? 'defineExpose' : 'expose'
      yield factory.code(`${funcName}({\n${exposedProperties.map(key => `  ${key},\n`).join('')}})`, factory.priority.effect)
    }
  },
})
