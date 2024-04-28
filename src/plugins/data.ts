import { isFunctionType } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'
import { getProperties, splitFunctionBody } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'data'
  },
  *transform({ node, options }, { factory, stringify, transform }) {
    if (isFunctionType(node) && node.body.type === 'BlockStatement') {
      const result = splitFunctionBody(node.body)
      if (!result) {
        throw new Error('"data" function needs to contain a return statement at the top level.')
      }
      const [returnStmt, stmtsBefore] = result
      const codeBefore = stringify(stmtsBefore)
      if (codeBefore) {
        yield factory.code(codeBefore + '\n')
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
          yield factory.property(key, 'data (reactivityTransform)')
          yield factory.code(`let ${key} = $ref(${stringify(value)})`)
        } else {
          hasRef = true
          yield factory.property(key, 'data')
          yield factory.code(`const ${key} = ref(${stringify(value)})`)
        }
      }
      if (hasRef) {
        yield factory.hoist(`import { ref } from 'vue'`)
      }
    }
  },
  *visitProperty({ name, source }) {
    if (source === 'data') {
      return `${name}.value`
    } else if (source === 'data (reactivityTransform)') {
      return name
    }
  },
})
