import { isFunctionType } from 'ast-kit'
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
        if (isFunctionType(value)) {
          yield factory.code(`${value.async ? 'async ' : ''}function ${key}(${value.params.map(param => magicString.sliceNode(param)).join(', ')}) ${magicString.sliceNode(value.body)}`, factory.priority.derived)
        } else {
          yield factory.code(`const ${key} = ${magicString.sliceNode(value)})`, factory.priority.derived)
        }
      }
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (source === 'methods') {
      yield factory.replace(name)
    }
  },
})
