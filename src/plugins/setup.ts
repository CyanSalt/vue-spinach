import { isFunctionType, isIdentifierOf } from 'ast-kit'
import { definePlugin } from '../plugin'
import { getProperties, splitFunctionBody } from '../transform'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'setup'
  },
  *transform({ node, magicString }, { factory, iterate, stringify }) {
    if (isFunctionType(node)) {
      const params = node.params
      if (params.length && params[0].type === 'Identifier') {
        const propsName = params[0].name
        if (propsName !== 'props') {
          yield factory.code(`const ${propsName} = props`)
        }
      }
      if (node.body.type === 'BlockStatement') {
        const result = splitFunctionBody(node.body)
        if (!result) {
          throw new Error('"setup" function needs to contain a return statement at the top level.')
        }
        const [returnStmt, stmtsBefore] = result
        const propsName = node.params.length && node.params[0].type === 'Identifier'
          ? node.params[0].name : undefined
        if (propsName) {
          iterate(stmtsBefore, childNode => {
            if (isIdentifierOf(childNode, propsName)) {
              magicString.overwriteNode(childNode, 'this')
            }
          })
        }
        const codeBefore = stringify(stmtsBefore)
        if (codeBefore) {
          yield factory.code(codeBefore)
        }
        if (returnStmt.argument?.type === 'ObjectExpression') {
          const properties = getProperties(returnStmt.argument)
          for (const [key, value] of Object.entries(properties)) {
            yield factory.property(key, 'setup')
            if (value.type !== 'Identifier' || value.name !== key) {
              // TODO: compat with reactivity transform
              yield factory.code(`const ${key} = ${stringify(value)}`)
            }
          }
        }
      }
    } else {
      return false
    }
  },
  *visitProperty({ name, path, source }, { factory }) {
    if (source === 'setup') {
      const parent = path.at(-1)!
      if (parent.type === 'AssignmentExpression') {
        return `${name}.value`
      } else {
        yield factory.hoist(`import { unref } from 'vue'`)
        return `unref(${name})`
      }
    }
  },
})
