import { isLiteralType, resolveString } from 'ast-kit'
import { camelCase, upperFirst } from 'lodash'
import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  filter: name => name === 'components',
  *transform(node, magicString) {
    if (node.type === 'ObjectExpression') {
      for (const property of node.properties) {
        if (property.type === 'ObjectProperty' && (
          property.key.type === 'Identifier'
          || isLiteralType(property.key)
        )) {
          const name = upperFirst(camelCase(resolveString(property.key)))
          const variableName = property.value.type === 'Identifier'
            ? property.value.name
            : undefined
          if (variableName !== name) {
            yield `const ${name} = ${magicString.sliceNode(property.value)}`
          }
        }
      }
    }
  },
})
