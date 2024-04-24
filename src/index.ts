import { parse } from '@vue/compiler-sfc'
import type { Script } from './ast'
import { createSourceLocation, parseScript } from './ast'
import { generateCode } from './generator'
import type { Plugin } from './plugin'
import transformComponents from './plugins/components'
import transformDirectives from './plugins/directives'
import { appendOptions, createDefineOptions, getDefineOptions, getOptions, prependStatements, replaceStatements, transformOptions } from './transform'

export interface TransformOptions {
  format?: 'composition' | 'option',
  scriptSetup?: boolean,
  reactivityTransform?: boolean,
  plugins?: Plugin[],
}

const builtinPlugins: Plugin[] = [
  transformComponents,
  transformDirectives,
]

const defaultOptions: Required<TransformOptions> = {
  format: 'composition',
  scriptSetup: true,
  reactivityTransform: false,
  plugins: [],
}

function transformScriptSetup(
  script: Script,
  scriptSetup: Script | undefined,
  plugins: Plugin[],
) {
  const options = getOptions(script.ast)
  if (options) {
    const { generated, properties } = transformOptions(options.object.properties, script.magicString, plugins)
    if (scriptSetup) {
      if (properties.length) {
        const defineOptions = getDefineOptions(scriptSetup.ast)
        if (defineOptions) {
          appendOptions(defineOptions.object, scriptSetup.magicString, properties, script.magicString)
        } else {
          generated.unshift(createDefineOptions(properties, script.magicString))
        }
      }
      if (generated.length) {
        prependStatements(scriptSetup.ast, scriptSetup.magicString, generated)
      }
    } else {
      if (properties.length) {
        generated.unshift(createDefineOptions(properties, script.magicString))
      }
      replaceStatements(options.exports, script.magicString, generated)
    }
  }
  return scriptSetup
    ? scriptSetup.magicString.toString()
    : script.magicString.toString()
}

export function transformSFC(code: string, options?: TransformOptions) {
  const {
    format,
    scriptSetup,
    plugins,
    reactivityTransform,
  } = { ...defaultOptions, ...options }
  const allPlugins = [...builtinPlugins, ...plugins]
  const { descriptor } = parse(code)
  const parsedScript = parseScript(descriptor.script)
  const parsedScriptSetup = parseScript(descriptor.scriptSetup)
  if (format === 'composition') {
    if (reactivityTransform) {
      throw new Error('"reactivityTransform" is not supported currently.')
    }
    if (scriptSetup) {
      if (parsedScript) {
        const content = transformScriptSetup(parsedScript, parsedScriptSetup, allPlugins)
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
      throw new Error('"scriptSetup" only supports true currently.')
    }
  } else {
    throw new Error('"format" only supports "composition" currently.')
  }
  return generateCode(descriptor)
}
