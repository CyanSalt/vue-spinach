import { isFunctionType } from 'ast-kit'
import { camelCase } from 'lodash-es'
import { definePlugin } from '../plugin'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'beforeRouteUpdate'
      || name === 'beforeRouteLeave'
  },
  *transform({ name, node }, { factory, stringify }) {
    if (isFunctionType(node)) {
      const funcName = camelCase(`on-${name}`)
      yield factory.code(`${funcName}(${node.async ? 'async ' : ''}(${stringify(node.params)}) => ${stringify(node.body)})`)
      yield factory.hoist(`import { ${funcName} } from 'vue-router'`)
    }
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
