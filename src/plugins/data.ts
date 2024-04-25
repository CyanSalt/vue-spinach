import type { ReturnStatement } from '@babel/types'
import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'data'
  },
  *transform({ node, magicString, options }, { factory, transform }) {
    if (node.type === 'FunctionExpression' || node.type === 'ObjectMethod') {
      const stmts = node.body.body
      const returnStmt = stmts.find((child): child is ReturnStatement => child.type === 'ReturnStatement')
      if (returnStmt && returnStmt.argument?.type === 'ObjectExpression') {
        const stmtsBefore = stmts.slice(0, stmts.indexOf(returnStmt))
        const codeBefore = magicString.sliceNode(stmtsBefore)
        if (codeBefore) {
          yield factory.code(codeBefore)
          yield factory.code('')
        }
        yield* transform(returnStmt.argument)
      } else {
        throw new Error('"data" function needs to contain a return statement of an object literal at the top level.')
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
      yield factory.code(`${name}.value`)
    } else if (source === 'data (reactivityTransform)') {
      yield factory.code(name)
    }
  },
})
