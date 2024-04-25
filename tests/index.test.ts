import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, test } from 'vitest'
import { transformSFC } from '../src'

describe('transformSFC', () => {

  test('transform Vue SFC into Composition API', async () => {
    const codeInOptionAPI = await fs.promises.readFile(
      path.join(import.meta.dirname, './samples/option-api.vue'),
      'utf-8',
    )
    const codeInCompositionAPI = await fs.promises.readFile(
      path.join(import.meta.dirname, './samples/composition-api.vue'),
      'utf-8',
    )
    const result = transformSFC(codeInOptionAPI)
    expect(result).toBe(codeInCompositionAPI)
  })

  test('transform Vue SFC into Composition API without script setup', async () => {
    const codeInOptionAPI = await fs.promises.readFile(
      path.join(import.meta.dirname, './samples/option-api.vue'),
      'utf-8',
    )
    const codeInCompositionAPIWithoutScriptSetup = await fs.promises.readFile(
      path.join(import.meta.dirname, './samples/composition-api-without-script-setup.vue'),
      'utf-8',
    )
    const result = transformSFC(codeInOptionAPI, {
      scriptSetup: false,
    })
    expect(result).toBe(codeInCompositionAPIWithoutScriptSetup)
  })

  test('transform Vue SFC into Composition API without props destructure', async () => {
    const codeInOptionAPI = await fs.promises.readFile(
      path.join(import.meta.dirname, './samples/option-api.vue'),
      'utf-8',
    )
    const codeInCompositionAPIWithoutPropsDestructure = await fs.promises.readFile(
      path.join(import.meta.dirname, './samples/composition-api-without-props-destructure.vue'),
      'utf-8',
    )
    const result = transformSFC(codeInOptionAPI, {
      propsDestructure: false,
    })
    expect(result).toBe(codeInCompositionAPIWithoutPropsDestructure)
  })

  test('transform Vue SFC into Composition API with reactivity transform', async () => {
    const codeInOptionAPI = await fs.promises.readFile(
      path.join(import.meta.dirname, './samples/option-api.vue'),
      'utf-8',
    )
    const codeInCompositionAPIWithReactivityTransform = await fs.promises.readFile(
      path.join(import.meta.dirname, './samples/composition-api-with-reactivity-transform.vue'),
      'utf-8',
    )
    const result = transformSFC(codeInOptionAPI, {
      reactivityTransform: true,
    })
    expect(result).toBe(codeInCompositionAPIWithReactivityTransform)
  })

})
