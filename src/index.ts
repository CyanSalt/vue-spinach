import { parse } from '@vue/compiler-sfc'
import type { Script } from './ast'
import { createSourceLocation, parseScript } from './ast'
import { generateCode } from './generator'
import type { Plugin } from './plugin'
import transformComponents from './plugins/components'
import transformComputed from './plugins/computed'
import transformData from './plugins/data'
import transformDirectives from './plugins/directives'
import transformMethods from './plugins/methods'
import { addImports, appendOptions, createDefineOptions, getDefineOptions, getOptions, prependStatements, replaceStatements, transformOptions, transformThisProperties } from './transform'

export interface TransformOptions {
  format?: 'composition' | 'option',
  scriptSetup?: boolean,
  reactivityTransform?: boolean,
  plugins?: Plugin[],
}

const builtinPlugins: Plugin[] = [
  transformComponents,
  transformDirectives,
  transformData,
  transformComputed,
  transformMethods,
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
  const baseScript = scriptSetup ?? script
  const options = getOptions(script.ast)
  if (!options) {
    return baseScript.magicString.toString()
  }
  const {
    code,
    imports: optionsImports,
    thisProperties,
    properties,
  } = transformOptions(options.object.properties, script.magicString, plugins)
  if (scriptSetup) {
    if (properties.length) {
      const defineOptions = getDefineOptions(scriptSetup.ast)
      if (defineOptions) {
        appendOptions(defineOptions.object, scriptSetup.magicString, properties, script.magicString)
      } else {
        code.push(createDefineOptions(properties, script.magicString))
      }
    }
    if (code.length) {
      prependStatements(scriptSetup.ast, scriptSetup.magicString, code)
    }
  } else {
    if (properties.length) {
      code.push(createDefineOptions(properties, script.magicString))
    }
    replaceStatements(options.exports, script.magicString, code)
  }
  addImports(baseScript.ast, baseScript.magicString, optionsImports)
  const transformed = parseScript({
    ...baseScript.block,
    content: baseScript.magicString.toString(),
  })!
  const {
    imports: thisPropertiesImports,
  } = transformThisProperties(transformed.ast, transformed.magicString, thisProperties, plugins)
  addImports(transformed.ast, transformed.magicString, thisPropertiesImports)
  return transformed.magicString.toString()
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
