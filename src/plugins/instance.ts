import { definePlugin } from '../plugin'

export default definePlugin({
  *visitProperty({ name, node, source }, { factory, stringify }) {
    if (source === undefined) {
      yield factory.hoist(`import { getCurrentInstance } from 'vue'`)
      yield factory.hoist(`const instance = getCurrentInstance()`)
      return `instance.proxy${name ? `.${name}` : `[${stringify(node.property)}]`}`
    }
  },
})
