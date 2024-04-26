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
      yield factory.imports('vue-router', funcName)
    }
  },
  *visitProperty({ name }, { factory }) {
    if (name === '$router') {
      yield factory.declare('useRouter()', 'router', true, false)
      yield factory.imports('vue-router', 'useRouter')
      yield factory.replace('router')
    } else if (name === '$route') {
      yield factory.declare('useRoute()', 'route', true, false)
      yield factory.imports('vue-router', 'useRoute')
      yield factory.replace('route')
    }
  },
})
