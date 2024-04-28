import { isFunctionType } from 'ast-kit'
import { camelCase } from 'lodash-es'
import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'beforeCreate'
      || name === 'created'
      || name === 'serverPrefetch'
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
  *transform({ name, node }, { factory, stringify }) {
    if (isFunctionType(node)) {
      const funcName = name === 'beforeCreate' || name === 'created'
        ? 'onBeforeMount'
        : (
          name === 'beforeDestroy' || name === 'destroyed'
            ? 'onUnmounted'
            : camelCase(`on-${name}`)
        )
      yield factory.code(`${funcName}(${node.async ? 'async ' : ''}(${stringify(node.params)}) => ${stringify(node.body)})`, factory.priority.effect)
      yield factory.hoist(`import { ${funcName} } from 'vue'`)
    }
  },
})
