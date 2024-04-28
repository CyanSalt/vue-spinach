import { definePlugin } from '../plugin'

export default definePlugin({
  transformInclude({ name }) {
    return name === 'emits'
  },
  *transform({ node, options }, { factory, stringify }) {
    yield factory.property('$emit', 'emit', false)
    if (options.scriptSetup) {
      yield factory.code(`const emit = defineEmits(${stringify(node)})`, factory.priority.interface)
    } else {
      return false
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (name === '$emit') {
      if (source !== 'emit') {
        yield factory.hoist(`const emit = defineEmits()`)
      }
      return 'emit'
    }
  },
})
