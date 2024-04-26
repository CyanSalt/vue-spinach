import { isFunctionType } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'
import { getPropertyValue, splitFunctionBody } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'provide'
  },
  *transform({ node, magicString }, { factory, transform }) {
    if (isFunctionType(node) && node.body.type === 'BlockStatement') {
      const result = splitFunctionBody(node.body)
      if (!result) {
        throw new Error('"provide" function needs to contain a return statement at the top level.')
      }
      const [returnStmt, stmtsBefore] = result
      const codeBefore = magicString.sliceNode(stmtsBefore)
      if (codeBefore) {
        yield factory.code(codeBefore)
        yield factory.code('')
      }
      if (returnStmt.argument?.type === 'ObjectExpression') {
        yield* transform(returnStmt.argument)
      }
      return
    }
    if (node.type === 'ObjectExpression') {
      let hasProvide = false
      for (const property of node.properties) {
        if (
          property.type === 'ObjectProperty'
          || property.type === 'ObjectMethod'
        ) {
          hasProvide = true
          const key = property.key
          const value = getPropertyValue(property)
          yield factory.code(`provide(${
            key.type === 'Identifier'
              ? `'${magicString.sliceNode(key)}'`
              : magicString.sliceNode(key)
          }, ${magicString.sliceNode(value)})`, factory.priority.effect)
        }
      }
      if (hasProvide) {
        yield factory.imports('vue', 'provide')
      }
    }
  },
})
