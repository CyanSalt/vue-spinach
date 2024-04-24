<script lang="ts" setup>
import { computed, ref } from 'vue'
// @ts-expect-error virtual file
import MyButton from '/path/to/MyButton.vue'
// @ts-expect-error virtual file
import MyClick from '/path/to/MyClick'

defineOptions({
  name: 'Foo',
})

const vMyClick = MyClick

const msg = ref('')

const formatted = computed(() => {
  return msg.value.trim()
})

function reset() {
  msg.value = ''
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
