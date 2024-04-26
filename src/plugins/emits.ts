import { defineSpinachPlugin } from '../plugin'

export default defineSpinachPlugin({
  transformInclude({ name }) {
    return name === 'emits'
  },
  *transform({ node, magicString, options }, { factory }) {
    yield factory.thisProperty('$emit', 'emit', false)
    if (options.scriptSetup) {
      yield factory.code(`const emit = defineEmits(${magicString.sliceNode(node)})`, factory.priority.interface)
    } else {
      yield factory.replace(false)
    }
  },
  *visitProperty({ name, source }, { factory }) {
    if (name === '$emit') {
      if (source !== 'emit') {
        yield factory.declare('defineEmits()', 'emit', true, false)
      }
      yield factory.replace('emit')
    }
  },
})
