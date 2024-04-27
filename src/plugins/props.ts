import { isLiteralType, resolveString } from 'ast-kit'
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
          yield factory.property(key, 'props (propsDestructure)', false)
        } else {
          yield factory.property(key, 'props', false)
        }
      }
    } else if (node.type === 'ArrayExpression') {
      for (const element of node.elements) {
        if (isLiteralType(element)) {
          const key = resolveString(element)
          if (options.scriptSetup && options.propsDestructure) {
            destructuredProps.push(key)
            yield factory.property(key, 'props (propsDestructure)', false)
          } else {
            yield factory.property(key, 'props', false)
          }
        }
      }
    }
    if (options.scriptSetup) {
      if (options.propsDestructure) {
        yield factory.code(`const {\n${
          destructuredProps.map(prop => `  ${prop},\n`).join('')
        }} = defineProps(${magicString.sliceNode(node)})`, factory.priority.interface)
      } else {
        yield factory.code(`const props = defineProps(${magicString.sliceNode(node)})`, factory.priority.interface)
      }
    } else {
      return false
    }
  },
  *visitProperty({ name, source }) {
    if (source === 'props') {
      return `props.${name}`
    } else if (source === 'props (propsDestructure)') {
      return name
    }
  },
})
