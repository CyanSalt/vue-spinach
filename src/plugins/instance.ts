import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  *visitProperty({ name, source }, { factory }) {
    if (source === undefined) {
      yield factory.hoist(`import { getCurrentInstance } from 'vue'`)
      yield factory.hoist(`const instance = getCurrentInstance()`)
      return `instance.proxy.${name}`
    }
  },
})
