<script lang="ts" setup>
import { ref, provide, inject, computed, watch, onMounted, unref } from 'vue'
// @ts-expect-error virtual file
import MyButton from '/path/to/MyButton.vue'
// @ts-expect-error virtual file
import MyClick from '/path/to/MyClick'

const vMyClick = MyClick

const type = inject('typeCtx', 'normal')

const {
  prefix = 'my:',
} = defineProps<{
  prefix?: string,
}>()

const emit = defineEmits<{
  (event: 'reset', ...args: unknown[]): void,
}>()

const suffix = ref('()')

const msg = ref('')

const formatted = computed(() => {
  return prefix + msg.value + unref(suffix)
})

function reset() {
  if (type) {
    msg.value = ''
  }
  emit('reset', msg.value)
}

provide('msg', msg.value)

defineExpose({
  reset,
})

watch(() => unref(suffix), async (value) => {
  reset()
}, {
  immediate: true,
})

onMounted(() => {
  msg.value = 'hello'
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
