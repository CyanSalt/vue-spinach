import type { Node, SpreadElement, VariableDeclaration } from '@babel/types'
import { isLiteralType, resolveString } from 'ast-kit'
import { camelCase } from 'lodash-es'
import { defineSpinachPlugin } from '../plugin'
import type { ObjectPropertyValueLike } from '../transform'
import { getProperties } from '../transform'

function getStoreProperties(node: Node) {
  if (node.type === 'ObjectExpression') {
    return getProperties(node)
  }
  const result: Record<string, ObjectPropertyValueLike> = {}
  if (node.type === 'ArrayExpression') {
    for (const element of node.elements) {
      if (isLiteralType(element)) {
        const name = resolveString(element)
        result[name] = element
      }
    }
  }
  return result
}

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'computed'
      || name === 'methods'
  },
  *transform({ node, magicString, options }, { factory }) {
    if (node.type === 'ObjectExpression') {
      let hasStoreToRefs = false
      let hasComputed = false
      let lines: string[] = []
      let decls: Record<string, {
        name?: string,
        names: string[],
        ref?: boolean,
      }> = {}
      const spreads = node.properties.filter((element): element is SpreadElement => element.type === 'SpreadElement')
      for (const element of spreads) {
        const mapCall = element.argument
        if (
          mapCall.type === 'CallExpression'
          && mapCall.callee.type === 'Identifier'
        ) {
          const mapName = resolveString(mapCall.callee)
          if (mapName === 'mapState' || mapName === 'mapGetters') {
            if (mapCall.arguments.length >= 2 && mapCall.arguments[0].type === 'Identifier') {
              const funcName = resolveString(mapCall.arguments[0])
              const properties = getStoreProperties(mapCall.arguments[1])
              for (const [key, value] of Object.entries(properties)) {
                if (options.reactivityTransform) {
                  yield factory.property(key, 'pinia computed (reactivityTransform)')
                } else {
                  yield factory.property(key, 'pinia computed')
                }
                let declName = key
                const storeExpr = `${funcName}()`
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!decls[storeExpr]) {
                  decls[storeExpr] = { names: [] }
                }
                if (isLiteralType(value)) {
                  const propName = resolveString(value)
                  if (propName !== key) {
                    declName = `${propName}: ${key}`
                  }
                  decls[storeExpr].ref = true
                  decls[storeExpr].names.push(declName)
                } else {
                  const storeName = camelCase(`store-from-${funcName}`)
                  decls[storeExpr].name = storeName
                  hasComputed = true
                  lines.push(`const ${key} = computed(() => {\n  return (${magicString.sliceNode(value)})(${storeName})\n})`)
                }
              }
            }
          } else if (mapName === 'mapActions') {
            if (mapCall.arguments.length >= 2 && mapCall.arguments[0].type === 'Identifier') {
              const funcName = resolveString(mapCall.arguments[0])
              const properties = getStoreProperties(mapCall.arguments[1])
              for (const [key, value] of Object.entries(properties)) {
                yield factory.property(key, 'pinia methods')
                let declName = key
                const storeExpr = `${funcName}()`
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!decls[storeExpr]) {
                  decls[storeExpr] = { names: [] }
                }
                if (isLiteralType(value)) {
                  const propName = resolveString(value)
                  if (propName !== key) {
                    declName = `${propName}: ${key}`
                  }
                  decls[storeExpr].names.push(declName)
                }
              }
            }
          }
        }
      }
      for (const [storeExpr, decl] of Object.entries(decls)) {
        let source = storeExpr
        if (decl.name) {
          source = decl.name
          yield factory.hoist(`const ${decl.name} = ${storeExpr}`, factory.priority.interface)
        }
        let kind: VariableDeclaration['kind'] = 'const'
        if (decl.ref) {
          if (options.reactivityTransform) {
            source = `$(${source})`
            kind = 'let'
          } else {
            hasStoreToRefs = true
            source = `storeToRefs(${source})`
          }
        }
        yield factory.hoist(`${kind} {\n${decl.names.map(name => `  ${name},\n`).join('')} } = ${source}`, factory.priority.interface)
      }
      for (const line of lines) {
        yield factory.code(line, factory.priority.interface)
      }
      if (hasStoreToRefs) {
        yield factory.hoist(`import { storeToRefs } from 'pinia'`)
      }
      if (hasComputed) {
        yield factory.hoist(`import { computed } from 'vue'`)
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
