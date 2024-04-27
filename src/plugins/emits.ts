import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'emits'
  },
  *transform({ node, magicString, options }, { factory }) {
    yield factory.property('$emit', 'emit', false)
    if (options.scriptSetup) {
      yield factory.code(`const emit = defineEmits(${magicString.sliceNode(node)})`, factory.priority.interface)
    } else {
      return false
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (name === 'emit') {
      if (source !== 'emit') {
        yield factory.hoist(`const emit = defineEmits()`)
      }
      return 'emit'
    }
  },
})
