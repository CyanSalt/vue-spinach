<template>
  <MyButton v-my-click="reset" class="foo">{{ formatted }}</MyButton>
</template>

<script lang="ts">
import { ref, computed } from 'vue'
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
    const suffix = ref('()')

    const msg = ref('')

    const formatted = computed(() => {
          return props.prefix + msg.value + suffix.value
        })

    function reset() {
          msg.value = ''
        }

    return {
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
