import { camelCase, upperFirst } from 'lodash'
import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name, options }) {
    return options.scriptSetup && name === 'components'
  },
  *transform({ node, magicString }, { factory }) {
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        const name = upperFirst(camelCase(key))
        const variableName = value.type === 'Identifier'
          ? value.name
          : undefined
        if (variableName !== name) {
          yield factory.code(`const ${name} = ${magicString.sliceNode(value)}`)
        }
      }
    }
  },
})
