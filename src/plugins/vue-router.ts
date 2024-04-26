import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
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
