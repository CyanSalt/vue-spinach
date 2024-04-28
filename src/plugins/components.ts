import { camelCase, upperFirst } from 'lodash-es'
import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name, options }) {
    return options.scriptSetup && name === 'components'
  },
  *transform({ node }, { factory, stringify }) {
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        const name = upperFirst(camelCase(key))
        const variableName = value.type === 'Identifier'
          ? value.name
          : undefined
        if (variableName !== name) {
          yield factory.hoist(`const ${name} = ${stringify(value)}`)
        }
      }
    }
  },
})
