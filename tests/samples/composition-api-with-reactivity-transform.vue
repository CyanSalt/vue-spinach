<script lang="ts" setup>
// @ts-expect-error virtual file
import MyButton from '/path/to/MyButton.vue'
// @ts-expect-error virtual file
import MyClick from '/path/to/MyClick'

defineOptions({
  name: 'Foo',
})

const vMyClick = MyClick

let msg = $ref('')

const formatted = $computed(() => {
  return msg.trim()
})

function reset() {
  msg = ''
}
</script>

<template>
  <MyButton v-my-click="reset" class="foo">{{ formatted }}</MyButton>
</template>

<style lang="scss" scoped>
.foo {
  color: black;
}
</style>
