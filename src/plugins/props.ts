import type { Node } from '@babel/types'
import { isFunctionType, isLiteralType, resolveLiteral, resolveString } from 'ast-kit'
import { definePlugin } from '../plugin'
import { getProperties } from '../transform'

function getTSType(node: Node | undefined) {
  if (!node) return 'any'
  if (node.type === 'ArrayExpression') {
    const types = node.elements
      .filter((element): element is Exclude<typeof element, null> => element !== null)
      .map(element => getTSType(element))
    return !types.length || types.includes('any') ? 'any' : types.join(' | ')
  }
  if (node.type === 'Identifier') {
    switch (node.name) {
      case 'Function':
        return 'Function'
      case 'Array':
        return 'any[]'
      case 'String':
      case 'Number':
      case 'Boolean':
      case 'Symbol':
      case 'BigInt':
      case 'Object':
        return node.name.toLowerCase()
    }
  }
  return 'any'
}

export default definePlugin({
  transformInclude({ name }) {
    return name === 'props'
  },
  *transform({ node, options }, { factory, stringify }) {
    const destructuredProps: Record<string, Node | true> = {}
    if (node.type === 'ObjectExpression') {
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        if (options.scriptSetup && options.propsDestructure) {
          destructuredProps[key] = value
          yield factory.property(key, 'props (propsDestructure)', false)
        } else {
          if (options.scriptSetup && options.typescript) {
            destructuredProps[key] = value
          }
          yield factory.property(key, 'props', false)
        }
      }
    } else if (node.type === 'ArrayExpression') {
      for (const element of node.elements) {
        if (isLiteralType(element)) {
          const key = resolveString(element)
          if (options.scriptSetup && options.propsDestructure) {
            destructuredProps[key] = true
            yield factory.property(key, 'props (propsDestructure)', false)
          } else {
            yield factory.property(key, 'props', false)
          }
        }
      }
    }
    if (options.scriptSetup) {
      let defineExpr: string
      let functionProps: string[] = []
      let defaults: Record<string, Node> = {}
      if (options.typescript) {
        let typings: string[] = []
        for (const [key, value] of Object.entries(destructuredProps)) {
          if (value === true) {
            typings.push(`${key}?: any`)
          } else {
            const propProperties: Record<string, Node> = value.type === 'ObjectExpression'
              ? getProperties(value)
              : { type: value }
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const required = propProperties.required ? (
              isLiteralType(propProperties.required)
                ? resolveLiteral(propProperties.required)
                : true
            ) : false
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (propProperties.default) {
              defaults[key] = propProperties.default
            }
            let type = getTSType(propProperties.type)
            if (type === 'Function') {
              functionProps.push(key)
              type = '(...args: any[]) => any'
            }
            typings.push(`${key}${required ? '' : '?'}: ${type}`)
          }
        }
        defineExpr = `defineProps<{\n${typings.map(item => `  ${item},\n`).join('')}}>()`
      } else {
        defineExpr = `defineProps(${stringify(node)})`
      }
      if (options.propsDestructure) {
        yield factory.code(`const {\n${
          Object.keys(destructuredProps)
            .map(key => {
              const hasFunctionDefaultValue = Boolean(defaults[key]) && isFunctionType(defaults[key])
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              const defaultValueExpr = defaults[key] ? stringify.fn(defaults[key], undefined, 2) : undefined
              return `  ${key}${defaultValueExpr ? ` = ${hasFunctionDefaultValue && !functionProps.includes(key) ? `(${defaultValueExpr}) as never` : defaultValueExpr}` : ''},\n`
            })
            .join('')
        }} = ${defineExpr}`, factory.priority.interface)
      } else {
        const defaultValues = Object.entries(defaults)
        if (defaultValues.length) {
          defineExpr = `withDefaults(${defineExpr}, {\n${defaultValues.map(([key, value]) => `  ${key}: ${stringify.fn(value)},\n`).join('')}})`
        }
        yield factory.code(`const props = ${defineExpr}`, factory.priority.interface)
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
