import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'props'
  },
  *transform({ node, magicString, options }, { factory }) {
    const destructuredProps: string[] = []
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const key of Object.keys(properties)) {
        if (options.scriptSetup && options.propsDestructure) {
          destructuredProps.push(key)
          yield factory.thisProperty(key, 'props (propsDestructure)', false)
        } else {
          yield factory.thisProperty(key, 'props', false)
        }
      }
    }
    if (options.scriptSetup) {
      if (options.propsDestructure) {
        yield factory.code(`const {\n${
          destructuredProps.map(prop => `  ${prop},\n`).join('')
        }} = defineProps(${magicString.sliceNode(node)})`)
      } else {
        yield factory.code(`const props = defineProps(${magicString.sliceNode(node)})`)
      }
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (source === 'props') {
      yield factory.code(`props.${name}`)
    } else if (source === 'props (propsDestructure)') {
      yield factory.code(name)
    }
  },
})
