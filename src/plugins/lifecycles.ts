import { isFunctionType } from 'ast-kit'
import { camelCase } from 'lodash-es'
import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'beforeCreate'
      || name === 'created'
      || name === 'beforeMount'
      || name === 'mounted'
      || name === 'beforeUpdate'
      || name === 'updated'
      || name === 'activated'
      || name === 'deactivated'
      || name === 'beforeUnmount'
      || name === 'unmounted'
      || name === 'beforeDestroy'
      || name === 'destroyed'
      || name === 'renderTracked'
      || name === 'renderTriggered'
      || name === 'errorCaptured'
  },
  *transform({ name, node, magicString }, { factory }) {
    if (isFunctionType(node)) {
      const funcName = name === 'beforeCreate' || name === 'created'
        ? 'onBeforeMount'
        : (
          name === 'beforeDestroy' || name === 'destroyed'
            ? 'onUnmounted'
            : camelCase(`on-${name}`)
        )
      yield factory.code(`${funcName}(${node.async ? 'async ' : ''}(${node.params.map(param => magicString.sliceNode(param)).join(', ')}) => ${magicString.sliceNode(node.body)})`)
      yield factory.imports('vue', funcName)
    }
  },
})
