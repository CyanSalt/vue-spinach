import { parse } from '@vue/compiler-sfc'
import type { VueScript } from './ast'
import { createSourceLocation, parseVueScript } from './ast'
import { generateCode } from './generator'
import type { Plugin, TransformOptions } from './plugin'
import transformComponents from './plugins/components'
import transformComputed from './plugins/computed'
import transformData from './plugins/data'
import transformDirectives from './plugins/directives'
import transformEmits from './plugins/emits'
import transformExpose from './plugins/expose'
import transformInject from './plugins/inject'
import transformInstance from './plugins/instance'
import transformLifecycles from './plugins/lifecycles'
import transformMethods from './plugins/methods'
import transformPinia from './plugins/pinia'
import transformProps from './plugins/props'
import transformProvide from './plugins/provide'
import transformSetup from './plugins/setup'
import transformVueRouter from './plugins/vue-router'
import transformWatch from './plugins/watch'
import { appendOptions, createDefineOptions, createExportOptions, createSetupReturn, generateHoistedCode, generateLocalCode, getDefineOptions, getOptions, insertHoistedCode, insertLocalCode, replaceWithCode, transformOptions, transformThisProperties } from './transform'

export type {
  Plugin,
  TransformOptions,
}

export { definePlugin } from './plugin'

const builtinPlugins: Plugin[] = [
  transformComponents,
  transformDirectives,
  transformProvide,
  transformInject,
  transformProps,
  transformEmits,
  transformSetup,
  transformData,
  transformComputed,
  transformWatch,
  transformLifecycles,
  transformMethods,
  transformExpose,
  transformPinia,
  transformVueRouter,
  // fallback
  transformInstance,
]

function transformVueScript(
  script: VueScript,
  scriptSetup: VueScript | undefined,
  options: TransformOptions,
) {
  const baseScript = scriptSetup ?? script
  // Step 1: options to compositions
  const vueOptions = getOptions(script.ast)
  if (!vueOptions) {
    return baseScript.magicString.toString()
  }
  const {
    local: optionsLocal,
    hoisted: optionsHoisted,
    instanceProperties,
    optionProperties,
  } = transformOptions(vueOptions.object.properties, script.magicString, options)
  let optionsLocalCode = generateLocalCode(optionsLocal)
  if (scriptSetup) {
    if (optionProperties.length) {
      const defineOptions = getDefineOptions(scriptSetup.ast)
      if (defineOptions) {
        appendOptions(defineOptions.object, scriptSetup.magicString, optionProperties, script.magicString)
      } else {
        optionsLocalCode += '\n\n' + createDefineOptions(optionProperties, script.magicString)
      }
    }
    insertLocalCode(scriptSetup.ast, scriptSetup.magicString, optionsLocalCode)
  } else if (options.scriptSetup) {
    if (optionProperties.length) {
      optionsLocalCode += '\n\n' + createDefineOptions(optionProperties, script.magicString)
    }
    replaceWithCode(vueOptions.exports, script.magicString, optionsLocalCode)
  }
  const optionsHoistedCode = generateHoistedCode(baseScript.ast, baseScript.magicString, optionsHoisted, options)
  insertHoistedCode(baseScript.ast, baseScript.magicString, optionsHoistedCode)
  // Step 2: traverse this[key]
  const transformed = parseVueScript({
    ...baseScript.block,
    content: options.scriptSetup
      ? baseScript.magicString.toString()
      : optionsLocalCode,
  })!
  const {
    local: thisPropertiesLocal,
    hoisted: thisPropertiesHoisted,
  } = transformThisProperties(transformed.ast, transformed.magicString, instanceProperties, options)
  let thisPropertiesLocalCode = generateLocalCode(thisPropertiesLocal)
  insertLocalCode(transformed.ast, transformed.magicString, thisPropertiesLocalCode)
  if (options.scriptSetup) {
    const thisPropertiesHoistedCode = generateHoistedCode(
      transformed.ast,
      transformed.magicString,
      thisPropertiesHoisted,
      options,
    )
    insertHoistedCode(transformed.ast, transformed.magicString, thisPropertiesHoistedCode)
    return transformed.magicString.toString()
  } else {
    const thisPropertiesHoistedCode = generateHoistedCode(
      script.ast,
      script.magicString,
      thisPropertiesHoisted,
      options,
    )
    insertHoistedCode(script.ast, script.magicString, thisPropertiesHoistedCode)
    const returnCode = createSetupReturn(instanceProperties)
    const setupBodyCode = transformed.magicString.toString()
    replaceWithCode(
      vueOptions.exports,
      script.magicString,
      createExportOptions(optionProperties, script.magicString, setupBodyCode + `\n\n` + returnCode),
    )
    return script.magicString.toString()
  }
}

const defaultOptions: Required<TransformOptions> = {
  scriptSetup: true,
  reactivityTransform: false,
  propsDestructure: true,
  aliases: {},
  plugins: builtinPlugins,
}

export function transformSFC(code: string, userOptions?: Partial<TransformOptions>) {
  const options = {
    ...defaultOptions,
    ...userOptions,
    aliases: { ...defaultOptions.aliases, ...userOptions?.aliases },
    // Keep fallback plugin at last
    plugins: [...(userOptions?.plugins ?? []), ...defaultOptions.plugins],
  }
  const { descriptor } = parse(code, {
    filename: `sfc.vue#${JSON.stringify(options)}`,
  })
  const vueScript = parseVueScript(descriptor.script)
  const vueScriptSetup = parseVueScript(descriptor.scriptSetup)
  if (options.scriptSetup) {
    if (vueScript) {
      const content = transformVueScript(vueScript, vueScriptSetup, options)
      if (descriptor.scriptSetup) {
        descriptor.scriptSetup.content = content
      } else {
        descriptor.scriptSetup = {
          type: 'script',
          content,
          attrs: { ...vueScript.block.attrs, setup: true },
          loc: createSourceLocation(content),
        }
      }
      descriptor.script = null
    }
  } else {
    if (descriptor.scriptSetup) {
      throw new Error('Could not transform with an existing <script setup> tag when "scriptSetup" is set to false.')
    }
    if (vueScript) {
      const content = transformVueScript(vueScript, vueScriptSetup, options)
      descriptor.script!.content = content
    }
  }
  return generateCode(descriptor)
}
