import type { Function, Node } from '@babel/types'
import { isFunctionType } from 'ast-kit'
import { defineSpinachPlugin } from '../plugin'
import { getProperties } from '../transform'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'watch'
  },
  *transform({ node, magicString }, { factory }) {
    if (node.type === 'ObjectExpression') {
      let hasWatch = false
      const properties = getProperties(node)
      for (const [key, value] of Object.entries(properties)) {
        let handler: Function | undefined
        let options: Node[] = []
        if (isFunctionType(value)) {
          handler = value
        } else if (value.type === 'ObjectExpression') {
          const watchProperties = getProperties(value)
          if (isFunctionType(watchProperties.handler)) {
            handler = watchProperties.handler
          }
          options = value.properties.filter(property => property !== handler)
        }
        if (handler) {
          const handlerExpr = `${handler.async ? 'async ' : ''}(${handler.params.map(param => magicString.sliceNode(param)).join(', ')}) => ${magicString.sliceNode(handler.body)}`
          const optionsExpr = options.length ? `{\n${options.map(option => `  ${magicString.sliceNode(option)},\n`).join('')}}` : undefined
          hasWatch = true
          yield factory.code(`watch(() => this.${key}, ${handlerExpr}${optionsExpr ? `, ${optionsExpr}` : ''})`, factory.priority.effect)
        }
      }
      if (hasWatch) {
        yield factory.hoist(`import { watch } from 'vue'`)
      }
    }
  },
})
