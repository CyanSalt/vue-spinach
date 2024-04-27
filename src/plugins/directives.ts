import { camelCase } from 'lodash-es'
import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name, options }) {
    return options.scriptSetup && name === 'directives'
  },
  *transform({ node, magicString }, { factory }) {
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        const name = camelCase('v-' + key)
        const variableName = value.type === 'Identifier'
          ? value.name
          : undefined
        if (variableName !== name) {
          yield factory.hoist(`const ${name} = ${magicString.sliceNode(value)}`)
        }
      }
    }
  },
})
