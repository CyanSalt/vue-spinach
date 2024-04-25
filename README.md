# vue-spinach

[![npm](https://img.shields.io/npm/v/vue-spinach.svg)](https://www.npmjs.com/package/vue-spinach)

> Popeye can save Olive with the power of spinach. So do Olive.

Transform Vue SFC between Option API and Composition API.

> [!NOTE]
> This is **NOT** an official library of Vue.

> [!TIP]
> Currently only the transformation from Option API to Composition API is supported.

## Usage

### CLI

```shell
pnpm dlx vue-spinach <inFile> [--print] [--out outFile] [--config configFile]
```

vue-spinach will read the file contents from `process.stdin` if `inFile` is not specified.

`outFile` defaults to the same as `inFile`, unless `inFile` is not specified or `print` is specified. Then it will be output via `process.stdout`.

`configFile` specifies an ES Module file with default exports. Refer to [Options](#options).

### JS API

```ts
import type { TransformOptions } from 'vue-spinach'
import { transformSFC } from 'vue-spinach'

function transformSFC(code: string, userOptions?: Partial<TransformOptions>): string
```

```js
import { transformSFC } from 'vue-spinach'

const code = transformSFC(`
<script>
export default {
  // ...
}
</script>
`, {
  reactivityTransform: true,
})
```

### Options

```ts
interface TransformOptions {
  /**
   * Whether to generate <script setup> block.
   * @default true
   */
  scriptSetup: boolean,
  /**
   * Whether to generate code using [Reactivity Transform]{@link https://vue-macros.dev/features/reactivity-transform.html}.
   * @default false
   */
  reactivityTransform: boolean,
  /**
   * Whether to destructure props defined by `defineProps`.
   * Only valid when `scriptSetup` is `true`.
   * @default true
   */
  propsDestructure: boolean,
  /**
   * Specifies a mapping of import names.
   * For example `{ 'vue-router': 'vue-router-v4' }`.
   * @default {}
   */
  aliases: Record<string, string>,
  /**
   * Specifies additional plugins.
   * Plugins that transform Vue's built-in options are always enabled.
   * @default [...builtinPlugins]
   */
  plugins: Plugin[],
}
```

### Plugin
