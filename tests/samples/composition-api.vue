<script lang="ts" setup>
import { ref, provide, inject, computed, onMounted } from 'vue'
// @ts-expect-error virtual file
import MyButton from '/path/to/MyButton.vue'
// @ts-expect-error virtual file
import MyClick from '/path/to/MyClick'

const vMyClick = MyClick

const type = inject('typeCtx', 'normal')

const {
  prefix,
} = defineProps({
    prefix: {
      type: String,
      default: 'my:',
    },
  })

const suffix = ref('()')

const msg = ref('')

const formatted = computed(() => {
      return prefix + msg.value + suffix.value
    })

function reset() {
      if (type.value) {
        msg.value = ''
      }
    }

provide('msg', msg.value)

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
