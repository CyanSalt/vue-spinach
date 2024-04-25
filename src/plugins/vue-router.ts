import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  *visitProperty({ name }, { factory }) {
    if (name === '$router') {
      yield factory.code(`const router = useRouter()`, true)
      yield factory.imports('vue-router', 'useRouter')
      yield factory.replace('router')
    } else if (name === '$route') {
      yield factory.code(`const route = useRoute()`, true)
      yield factory.imports('vue-router', 'useRoute')
      yield factory.replace('route')
    }
  },
})
