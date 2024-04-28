import { isFunctionType } from 'ast-kit'
import { definePlugin } from '../plugin'
import { getProperties } from '../transform'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'computed'
  },
  *transform({ node, options }, { factory, stringify }) {
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      let hasComputed = false
      for (const [key, value] of Object.entries(properties)) {
        const argCode = value.type === 'ObjectMethod'
          ? `${value.async ? 'async ' : ''}(${stringify(value.params)}) => ${stringify(value.body)}`
          : stringify(value)
        if (options.reactivityTransform) {
          yield factory.property(key, 'computed (reactivityTransform)')
          yield factory.code(`${isFunctionType(value) ? 'const' : 'let'} ${key} = $computed(${argCode})`, factory.priority.derived)
        } else {
          hasComputed = true
          yield factory.property(key, 'computed')
          yield factory.code(`const ${key} = computed(${argCode})`, factory.priority.derived)
        }
      }
      if (hasComputed) {
        yield factory.hoist(`import { computed } from 'vue'`)
      }
    }
  },
  *visitProperty({ name, source }) {
    if (source === 'computed') {
      return `${name}.value`
    } else if (source === 'computed (reactivityTransform)') {
      return name
    }
  },
})
