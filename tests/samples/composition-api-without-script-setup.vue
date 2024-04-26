<template>
  <MyButton v-my-click="reset" class="foo">{{ formatted }}</MyButton>
</template>

<script lang="ts">
import { ref, provide, inject, computed, watch, onMounted } from 'vue'
// @ts-expect-error virtual file
import MyButton from '/path/to/MyButton.vue'
// @ts-expect-error virtual file
import MyClick from '/path/to/MyClick'

export default {
  name: 'Foo',
  components: {
    MyButton,
  },
  directives: {
    'my-click': MyClick,
  },
  setup(props) {
    const type = inject('typeCtx', 'normal')

    const suffix = ref('()')

    const msg = ref('')

    const formatted = computed(() => {
          return props.prefix + msg.value + suffix.value
        })

    function reset() {
          if (type.value) {
            msg.value = ''
          }
        }

    provide('msg', msg.value)

    watch(() => suffix.value, async (value) => {
            reset()
          }, {
      immediate: true,
    })

    onMounted(() => {
        msg.value = 'hello'
      })

    return {
      type,
      suffix,
      msg,
      formatted,
      reset,
    }
  },
}
</script>

<style lang="scss" scoped>
.foo {
  color: black;
}
</style>
