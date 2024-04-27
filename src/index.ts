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
import { addImportDeclarations, addVariableDeclarations, appendOptions, createDefineOptions, createExportOptions, createSetupReturn, getDefineOptions, getOptions, prependStatements, replaceStatements, transformOptions, transformThisProperties } from './transform'

export type {
  Plugin,
  TransformOptions,
}

export { defineSpinachPlugin } from './plugin'

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
    code: optionsCode,
    imports: optionsImports,
    decls: optionsDecls,
    instanceProperties,
    optionProperties,
  } = transformOptions(vueOptions.object.properties, script.magicString, options)
  if (scriptSetup) {
    if (optionProperties.length) {
      const defineOptions = getDefineOptions(scriptSetup.ast)
      if (defineOptions) {
        appendOptions(defineOptions.object, scriptSetup.magicString, optionProperties, script.magicString)
      } else {
        optionsCode.push(createDefineOptions(optionProperties, script.magicString))
      }
    }
    if (optionsCode.length) {
      prependStatements(scriptSetup.ast, scriptSetup.magicString, optionsCode)
    }
  } else if (options.scriptSetup) {
    if (optionProperties.length) {
      optionsCode.push(createDefineOptions(optionProperties, script.magicString))
    }
    replaceStatements(vueOptions.exports, script.magicString, optionsCode)
  }
  addImportDeclarations(baseScript.ast, baseScript.magicString, optionsImports)
  addVariableDeclarations(baseScript.ast, baseScript.magicString, optionsDecls)
  // Step 2: traverse this[key]
  const transformed = parseVueScript({
    ...baseScript.block,
    content: options.scriptSetup
      ? baseScript.magicString.toString()
      : optionsCode.join('\n\n'),
  })!
  const {
    code: thisPropertiesCode,
    imports: thisPropertiesImports,
    decls: thisPropertiesDecls,
  } = transformThisProperties(transformed.ast, transformed.magicString, instanceProperties, options)
  if (thisPropertiesCode.length) {
    prependStatements(transformed.ast, transformed.magicString, thisPropertiesCode)
  }
  if (options.scriptSetup) {
    addImportDeclarations(transformed.ast, transformed.magicString, thisPropertiesImports)
    addVariableDeclarations(transformed.ast, transformed.magicString, thisPropertiesDecls)
    return transformed.magicString.toString()
  } else {
    addImportDeclarations(script.ast, script.magicString, thisPropertiesImports)
    addVariableDeclarations(script.ast, script.magicString, thisPropertiesDecls)
    const returnCode = createSetupReturn(instanceProperties)
    const setupBodyCode = transformed.magicString.toString()
    replaceStatements(
      vueOptions.exports,
      script.magicString,
      [createExportOptions(optionProperties, script.magicString, setupBodyCode + `\n\n` + returnCode)],
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
