<template>
  <MyButton v-my-click="reset" class="foo">{{ formatted }}</MyButton>
</template>

<script lang="ts">
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
  data() {
    return {
      msg: '',
    }
  },
  computed: {
    formatted() {
      return this.prefix + this.msg
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
