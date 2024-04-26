<script lang="ts" setup>
import { ref, provide, computed, onMounted } from 'vue'
// @ts-expect-error virtual file
import MyButton from '/path/to/MyButton.vue'
// @ts-expect-error virtual file
import MyClick from '/path/to/MyClick'

const vMyClick = MyClick

const props = defineProps({
    prefix: {
      type: String,
      default: 'my:',
    },
  })

const suffix = ref('()')

const msg = ref('')

const formatted = computed(() => {
      return props.prefix + msg.value + suffix.value
    })

onMounted(() => {
    msg.value = 'hello'
  })

function reset() {
      msg.value = ''
    }

provide('msg', msg.value)

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
