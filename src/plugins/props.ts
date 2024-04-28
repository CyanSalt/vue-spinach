import { isLiteralType, resolveString } from 'ast-kit'
import { definePlugin } from '../plugin'
import { getProperties } from '../transform'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'props'
  },
  *transform({ node, options }, { factory, stringify }) {
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
        }} = defineProps(${stringify(node)})`, factory.priority.interface)
      } else {
        yield factory.code(`const props = defineProps(${stringify(node)})`, factory.priority.interface)
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
