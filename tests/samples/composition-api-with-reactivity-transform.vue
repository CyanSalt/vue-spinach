<script lang="ts" setup>
import { ref, provide, inject, watch, onMounted } from 'vue'
// @ts-expect-error virtual file
import MyButton from '/path/to/MyButton.vue'
// @ts-expect-error virtual file
import MyClick from '/path/to/MyClick'

const vMyClick = MyClick

let type = $(inject('typeCtx', 'normal'))

const {
  prefix,
} = defineProps({
    prefix: {
      type: String,
      default: 'my:',
    },
  })

const emit = defineEmits(['reset'])

const suffix = ref('()')

let msg = $ref('')

const formatted = $computed(() => {
      return prefix + msg + suffix.value
    })

function reset() {
      if (type) {
        msg = ''
      }
      emit('reset', msg)
    }

provide('msg', msg)

defineExpose({
  reset,
})

watch(() => suffix.value, async (value) => {
        reset()
      }, {
  immediate: true,
})

onMounted(() => {
    msg = 'hello'
  })

defineOptions({
  name: 'Foo',
})
</script>

<template>
  <MyButton v-my-click="reset" class="foo">{{ formatted }}</MyButton>
</template>

<style lang="scss" scoped>
.foo {
  color: black;
}
</style>
