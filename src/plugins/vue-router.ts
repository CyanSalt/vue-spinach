import { isFunctionType } from 'ast-kit'
import { camelCase } from 'lodash-es'
import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'beforeRouteUpdate'
      || name === 'beforeRouteLeave'
  },
  *transform({ name, node, magicString }, { factory }) {
    if (isFunctionType(node)) {
      const funcName = camelCase(`on-${name}`)
      yield factory.code(`${funcName}(${node.async ? 'async ' : ''}(${node.params.map(param => magicString.sliceNode(param)).join(', ')}) => ${magicString.sliceNode(node.body)})`)
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
