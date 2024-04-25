import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'methods'
  },
  *transform({ node, magicString }, { factory }) {
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        yield factory.thisProperty(key, 'methods')
        if (value.type === 'ObjectMethod' || value.type === 'FunctionExpression') {
          yield factory.code(`function ${key}(${value.params.map(param => magicString.sliceNode(param)).join(', ')}) ${magicString.sliceNode(value.body)}`)
        } else {
          yield factory.code(`const ${key} = ${magicString.sliceNode(value)})`)
        }
      }
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (source === 'computed') {
      yield factory.code(name)
    }
  },
})
