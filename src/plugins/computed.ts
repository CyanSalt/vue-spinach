import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'computed'
  },
  *transform({ node, magicString }, { factory }) {
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      let hasComputed = false
      for (const [key, value] of Object.entries(properties)) {
        hasComputed = true
        yield factory.thisProperty(key, 'computed')
        const argCode = value.type === 'ObjectMethod'
          ? `(${value.params.map(param => magicString.sliceNode(param)).join(', ')}) => ${magicString.sliceNode(value.body)}`
          : magicString.sliceNode(value)
        yield factory.code(`const ${key} = computed(${argCode})`)
      }
      if (hasComputed) {
        yield factory.imports('vue', 'computed')
      }
    }
  },
  *visitProperty({ name, properties }, { factory }) {
    if (properties.some(item => item.name === name && item.source === 'computed')) {
      yield factory.code(`${name}.value`)
    }
  },
})
