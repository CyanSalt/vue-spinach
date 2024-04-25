<template>
  <MyButton v-my-click="reset" class="foo">{{ formatted }}</MyButton>
</template>

<script lang="ts">
import { ref } from 'vue'
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
  props: {
    prefix: {
      type: String,
      default: 'my:',
    },
  },
  setup() {
    const suffix = ref('()')

    return {
      suffix,
    }
  },
  data() {
    return {
      msg: '',
    }
  },
  computed: {
    formatted() {
      return this.prefix + this.msg + this.suffix
    },
  },
  methods: {
    reset() {
      this.msg = ''
    },
  },
}
</script>

<style lang="scss" scoped>
.foo {
  color: black;
}
</style>
