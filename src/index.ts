import { parse } from '@vue/compiler-sfc'
import type { Script } from './ast'
import { createSourceLocation, parseScript } from './ast'
import { generateCode } from './generator'
import type { Plugin, TransformOptions } from './plugin'
import transformComponents from './plugins/components'
import transformComputed from './plugins/computed'
import transformData from './plugins/data'
import transformDirectives from './plugins/directives'
import transformLifecycles from './plugins/lifecycles'
import transformMethods from './plugins/methods'
import transformPinia from './plugins/pinia'
import transformProps from './plugins/props'
import transformSetup from './plugins/setup'
import transformVueRouter from './plugins/vue-router'
import { addImports, appendOptions, createDefineOptions, createExportOptions, createSetupReturn, getDefineOptions, getOptions, prependStatements, replaceStatements, transformOptions, transformThisProperties } from './transform'

const defaultOptions: Required<TransformSFCOptions> = {
  scriptSetup: true,
  reactivityTransform: false,
  propsDestructure: true,
  plugins: [],
}

const builtinPlugins: Plugin[] = [
  transformComponents,
  transformDirectives,
  transformProps,
  transformSetup,
  transformData,
  transformComputed,
  transformLifecycles,
  transformMethods,
  transformPinia,
  transformVueRouter,
]

function transformScript(
  script: Script,
  scriptSetup: Script | undefined,
  plugins: Plugin[],
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
    thisProperties,
    properties,
  } = transformOptions(vueOptions.object.properties, script.magicString, plugins, options)
  if (scriptSetup) {
    if (properties.length) {
      const defineOptions = getDefineOptions(scriptSetup.ast)
      if (defineOptions) {
        appendOptions(defineOptions.object, scriptSetup.magicString, properties, script.magicString)
      } else {
        optionsCode.push(createDefineOptions(properties, script.magicString))
      }
    }
    if (optionsCode.length) {
      prependStatements(scriptSetup.ast, scriptSetup.magicString, optionsCode)
    }
  } else if (options.scriptSetup) {
    if (properties.length) {
      optionsCode.push(createDefineOptions(properties, script.magicString))
    }
    replaceStatements(vueOptions.exports, script.magicString, optionsCode)
  }
  addImports(baseScript.ast, baseScript.magicString, optionsImports)
  // Step 2: traverse this[key]
  const transformed = parseScript({
    ...baseScript.block,
    content: options.scriptSetup
      ? baseScript.magicString.toString()
      : optionsCode.join('\n\n'),
  })!
  const {
    code: thisPropertiesCode,
    imports: thisPropertiesImports,
  } = transformThisProperties(transformed.ast, transformed.magicString, thisProperties, plugins)
  if (thisPropertiesCode.length) {
    prependStatements(transformed.ast, transformed.magicString, thisPropertiesCode)
  }
  addImports(transformed.ast, transformed.magicString, thisPropertiesImports)
  if (options.scriptSetup) {
    return transformed.magicString.toString()
  } else {
    const returnCode = createSetupReturn(thisProperties)
    const setupBodyCode = transformed.magicString.toString()
    replaceStatements(
      vueOptions.exports,
      script.magicString,
      [createExportOptions(properties, script.magicString, setupBodyCode + `\n\n` + returnCode)],
    )
    return script.magicString.toString()
  }
}

export interface TransformSFCOptions extends Partial<TransformOptions> {
  plugins?: Plugin[],
}

export function transformSFC(code: string, options?: TransformSFCOptions) {
  const {
    plugins,
    ...pluginOptions
  } = { ...defaultOptions, ...options }
  const allPlugins = [...builtinPlugins, ...plugins]
  const { descriptor } = parse(code, {
    filename: `sfc.vue#${JSON.stringify(options)}`,
  })
  const parsedScript = parseScript(descriptor.script)
  const parsedScriptSetup = parseScript(descriptor.scriptSetup)
  if (pluginOptions.scriptSetup) {
    if (parsedScript) {
      const content = transformScript(parsedScript, parsedScriptSetup, allPlugins, pluginOptions)
      if (descriptor.scriptSetup) {
        descriptor.scriptSetup.content = content
      } else {
        descriptor.scriptSetup = {
          type: 'script',
          content,
          attrs: { ...parsedScript.block.attrs, setup: true },
          loc: createSourceLocation(content),
        }
      }
      descriptor.script = null
    }
  } else {
    if (descriptor.scriptSetup) {
      throw new Error('Could not transform with an existing <script setup> tag when "scriptSetup" is set to false.')
    }
    if (parsedScript) {
      const content = transformScript(parsedScript, parsedScriptSetup, allPlugins, pluginOptions)
      descriptor.script!.content = content
    }
  }
  return generateCode(descriptor)
}
