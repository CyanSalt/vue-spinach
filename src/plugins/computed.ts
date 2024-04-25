import { isFunctionType } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'computed'
  },
  *transform({ node, magicString, options }, { factory }) {
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      let hasComputed = false
      for (const [key, value] of Object.entries(properties)) {
        const argCode = value.type === 'ObjectMethod'
          ? `${value.async ? 'async ' : ''}(${value.params.map(param => magicString.sliceNode(param)).join(', ')}) => ${magicString.sliceNode(value.body)}`
          : magicString.sliceNode(value)
        if (options.reactivityTransform) {
          yield factory.thisProperty(key, 'computed (reactivityTransform)')
          yield factory.code(`${isFunctionType(value) ? 'const' : 'let'} ${key} = $computed(${argCode})`)
        } else {
          hasComputed = true
          yield factory.thisProperty(key, 'computed')
          yield factory.code(`const ${key} = computed(${argCode})`)
        }
      }
      if (hasComputed) {
        yield factory.imports('vue', 'computed')
      }
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (source === 'computed') {
      yield factory.code(`${name}.value`)
    } else if (source === 'computed (reactivityTransform)') {
      yield factory.code(`${name}.value`)
    }
  },
})
