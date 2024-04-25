import type { CallExpression, Node, SpreadElement } from '@babel/types'
import { isLiteralType, resolveString } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

function getMappedKeys(node: Node) {
  return node.type === 'ObjectExpression'
    ? Object.keys(getProperties(node))
    : (
      node.type === 'ArrayExpression'
        ? node.elements.map(
          item => (isLiteralType(item) ? resolveString(item) : undefined),
        ).filter((value): value is NonNullable<typeof value> => value !== undefined)
        : []
    )
}

function extractMappingArguments(node: CallExpression) {
  let name: string | undefined
  let keys: string[] = []
  if (node.arguments.length >= 2 && node.arguments[0].type === 'Identifier') {
    name = resolveString(node.arguments[0])
    keys = getMappedKeys(node.arguments[1])
  }
  return {
    name,
    keys,
  }
}

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'computed'
      || name === 'methods'
  },
  *transform({ name, node, magicString, options }, { factory }) {
    if (node.type === 'ObjectExpression') {
      const spreads = node.properties.filter((element): element is SpreadElement => element.type === 'SpreadElement')
      for (const element of spreads) {
        const mapCall = element.argument
        if (
          mapCall.type === 'CallExpression'
          && mapCall.callee.type === 'Identifier'
        ) {
          const mapName = resolveString(mapCall.callee)
          if (name === 'computed' && (mapName === 'mapState' || mapName === 'mapGetters')) {
            const { name: funcName, keys } = extractMappingArguments(mapCall)
            for (const key of keys) {
              if (options.reactivityTransform) {
                yield factory.thisProperty(key, 'pinia computed (reactivityTransform)')
              } else {
                yield factory.thisProperty(key, 'pinia computed')
              }
            }
            if (funcName && keys.length) {
              if (options.reactivityTransform) {
                yield factory.code(`const {\n${keys.map(key => `  ${key},\n`).join('')}} = $(${funcName}())`)
              } else {
                yield factory.code(`const {\n${keys.map(key => `  ${key},\n`).join('')}} = ${funcName}()`)
              }
            }
          } else if (name === 'methods' && mapName === 'mapActions') {
            const { name: funcName, keys } = extractMappingArguments(mapCall)
            for (const key of keys) {
              yield factory.thisProperty(key, 'pinia methods')
            }
            if (funcName && keys.length) {
              yield factory.code(`const {\n${keys.map(key => `  ${key},\n`).join('')}} = ${funcName}()`)
            }
          }
        }
      }
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (source === 'pinia computed') {
      yield factory.replace(`${name}.value`)
    } else if (source === 'pinia computed (reactivityTransform)') {
      yield factory.replace(name)
    } else if (source === 'pinia methods') {
      yield factory.replace(name)
    }
  },
})
