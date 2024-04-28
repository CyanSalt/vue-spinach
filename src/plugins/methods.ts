import { isFunctionType } from 'ast-kit'
import { definePlugin } from '../plugin'
import { getProperties } from '../transform'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'methods'
  },
  *transform({ node }, { factory, stringify }) {
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        yield factory.property(key, 'methods')
        if (isFunctionType(value)) {
          yield factory.code(`${value.async ? 'async ' : ''}function ${key}(${stringify(value.params)}) ${stringify(value.body)}`, factory.priority.derived)
        } else {
          yield factory.code(`const ${key} = ${stringify(value)})`, factory.priority.derived)
        }
      }
    }
  },
  *visitProperty({ name, source }) {
    if (source === 'methods') {
      return name
    }
  },
})
