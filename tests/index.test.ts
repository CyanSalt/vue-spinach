import * as fs from 'node:fs'
import { describe, expect, test } from 'vitest'
import { transformSFC } from '../src'

describe('transformSFC', () => {

  test.skip('transform Vue SFC into Composition API', async () => {
    const codeInOptionAPI = await fs.promises.readFile(
      import.meta.resolve('../samples/option-api.vue'),
      'utf-8',
    )
    const codeInCompositionAPI = await fs.promises.readFile(
      import.meta.resolve('../samples/composition-api.vue'),
      'utf-8',
    )
    const result = transformSFC(codeInOptionAPI, {
      format: 'composition',
    })
    expect(result).toBe(codeInCompositionAPI)
  })

  test.skip('transform Vue SFC into Composition API without script setup', async () => {
    const codeInOptionAPI = await fs.promises.readFile(
      import.meta.resolve('../samples/option-api.vue'),
      'utf-8',
    )
    const codeInCompositionAPIWithoutScriptSetup = await fs.promises.readFile(
      import.meta.resolve('../samples/composition-api-without-script-setup.vue'),
      'utf-8',
    )
    const result = transformSFC(codeInOptionAPI, {
      format: 'composition',
      scriptSetup: false,
    })
    expect(result).toBe(codeInCompositionAPIWithoutScriptSetup)
  })

  test.skip('transform Vue SFC into Composition API with reactivity transform', async () => {
    const codeInOptionAPI = await fs.promises.readFile(
      import.meta.resolve('../samples/option-api.vue'),
      'utf-8',
    )
    const codeInCompositionAPIWithReactivityTransform = await fs.promises.readFile(
      import.meta.resolve('../samples/composition-api-with-reactivity-transform.vue'),
      'utf-8',
    )
    const result = transformSFC(codeInOptionAPI, {
      format: 'composition',
      reactivityTransform: true,
    })
    expect(result).toBe(codeInCompositionAPIWithReactivityTransform)
  })

})
