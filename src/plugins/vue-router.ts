import { camelCase } from 'lodash-es'
import { definePlugin } from '../plugin'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'beforeRouteUpdate'
      || name === 'beforeRouteLeave'
  },
  *transform({ name, node }, { factory, stringify }) {
    const funcName = camelCase(`on-${name}`)
    yield factory.code(`${funcName}(${stringify.fn(node)})`, factory.priority.effect)
    yield factory.hoist(`import { ${funcName} } from 'vue-router'`)
  },
  *visitProperty({ name }, { factory }) {
    if (name === '$router') {
      yield factory.hoist(`import { useRouter } from 'vue-router'`)
      yield factory.hoist(`const router = useRouter()`)
      return 'router'
    } else if (name === '$route') {
      yield factory.hoist(`import { useRoute } from 'vue-router'`)
      yield factory.hoist(`const route = useRoute()`)
      return 'route'
    }
  },
})
