import { camelCase } from 'lodash-es'
import { definePlugin } from '../plugin'

export default definePlugin({
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
    const funcName = name === 'beforeCreate' || name === 'created'
      ? 'onBeforeMount'
      : (
        name === 'beforeDestroy' || name === 'destroyed'
          ? 'onUnmounted'
          : camelCase(`on-${name}`)
      )
    yield factory.code(`${funcName}(${stringify.fn(node)})`, factory.priority.effect)
    yield factory.hoist(`import { ${funcName} } from 'vue'`)
  },
})
