import { isFunctionType } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'
import { getProperties, splitFunctionBody } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'data'
  },
  *transform({ node, magicString, options }, { factory, transform }) {
    if (isFunctionType(node) && node.body.type === 'BlockStatement') {
      const result = splitFunctionBody(node.body)
      if (!result) {
        throw new Error('"data" function needs to contain a return statement at the top level.')
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
      const properties = getProperties(node)
      let hasRef = false
      for (const [key, value] of Object.entries(properties)) {
        if (options.reactivityTransform) {
          yield factory.thisProperty(key, 'data (reactivityTransform)')
          yield factory.code(`let ${key} = $ref(${magicString.sliceNode(value)})`)
        } else {
          hasRef = true
          yield factory.thisProperty(key, 'data')
          yield factory.code(`const ${key} = ref(${magicString.sliceNode(value)})`)
        }
      }
      if (hasRef) {
        yield factory.imports('vue', 'ref')
      }
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (source === 'data') {
      yield factory.replace(`${name}.value`)
    } else if (source === 'data (reactivityTransform)') {
      yield factory.replace(name)
    }
  },
})
