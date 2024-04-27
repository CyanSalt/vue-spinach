import { isFunctionType } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'
import { getProperties, splitFunctionBody } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'setup'
  },
  *transform({ node, magicString }, { factory }) {
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
        const codeBefore = magicString.sliceNode(stmtsBefore)
        if (codeBefore) {
          yield factory.code(codeBefore)
        }
        if (returnStmt.argument?.type === 'ObjectExpression') {
          const properties = getProperties(returnStmt.argument)
          for (const [key, value] of Object.entries(properties)) {
            yield factory.property(key, 'setup')
            if (value.type !== 'Identifier' || value.name !== key) {
              // TODO: compat with reactivity transform
              yield factory.code(`const ${key} = ${magicString.sliceNode(value)}`)
            }
          }
        }
      }
    }
  },
  *visitProperty({ name, source }) {
    if (source === 'setup') {
      // TODO: not sure
      return `${name}.value`
    }
  },
})
