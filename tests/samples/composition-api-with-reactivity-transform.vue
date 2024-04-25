<script lang="ts" setup>
import { ref } from 'vue'
// @ts-expect-error virtual file
import MyButton from '/path/to/MyButton.vue'
// @ts-expect-error virtual file
import MyClick from '/path/to/MyClick'

const vMyClick = MyClick

const {
  prefix,
} = defineProps({
    prefix: {
      type: String,
      default: 'my:',
    },
  })

const suffix = ref('()')

let msg = $ref('')

const formatted = $computed(() => {
      return prefix + msg + suffix.value
    })

function reset() {
      msg = ''
    }

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
