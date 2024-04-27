import type { BlockStatement, CallExpression, ExportDefaultDeclaration, ExpressionStatement, ImportDeclaration, Node, ObjectExpression, ObjectMethod, ObjectProperty, Program, ReturnStatement, VariableDeclaration } from '@babel/types'
import { isIdentifierOf, isLiteralType, resolveString } from 'ast-kit'
import { sortBy } from 'lodash-es'
import type { MagicStringAST } from 'magic-string-ast'
import type { Fragment } from './ast'
import { parseScript, visitNode } from './ast'
import type { Plugin, Property, TransformHelpers, TransformOptions } from './plugin'
import { factory } from './plugin'

export function getOptions(ast: Program) {
  const exports = ast.body.find((node): node is ExportDefaultDeclaration => node.type === 'ExportDefaultDeclaration')
  if (exports) {
    const object = exports.declaration
    if (object.type !== 'ObjectExpression') {
      throw new Error('Only object literal default exports are supported currently.')
    }
    return {
      object,
      exports,
    }
  }
  return undefined
}

export function getDefineOptions(ast: Program) {
  const statement = ast.body.find((node): node is ExpressionStatement & { expression: CallExpression } => {
    return node.type === 'ExpressionStatement'
      && node.expression.type === 'CallExpression'
      && isIdentifierOf(node.expression.callee, 'defineOptions')
  })
  if (statement) {
    const call = statement.expression
    if (call.arguments.length === 1 && call.arguments[0].type === 'ObjectExpression') {
      return {
        statement,
        call,
        object: call.arguments[0],
      }
    }
  }
  return undefined
}

export type ObjectPropertyValueLike = ObjectProperty['value'] | ObjectMethod

export function getPropertyValue(node: ObjectProperty | ObjectMethod): ObjectPropertyValueLike {
  return node.type === 'ObjectProperty' ? node.value : node
}

interface PluginCodeManager {
  hoisted: {
    imports: Fragment<ImportDeclaration>[],
    decls: Fragment<VariableDeclaration>[],
  },
  local: Map<Plugin, {
    lines: string[],
    priority: number,
  }>,
}

function createPluginCodeManager(): PluginCodeManager {
  return {
    hoisted: {
      imports: [],
      decls: [],
    },
    local: new Map(),
  }
}

function getPluginCodeLocalData(manager: PluginCodeManager, plugin: Plugin) {
  if (!manager.local.has(plugin)) {
    manager.local.set(plugin, { lines: [], priority: 0 })
  }
  return manager.local.get(plugin)!
}

function addLocalCode(manager: PluginCodeManager, plugin: Plugin, code: string, priority: number) {
  const data = getPluginCodeLocalData(manager, plugin)
  data.lines.push(code)
  data.priority += priority
}

function addHoistedPluginCode(manager: PluginCodeManager, plugin: Plugin, code: string, priority: number) {
  const { ast, magicString: hoistedMagicString } = parseScript(code)
  if (ast.body.length === 1) {
    const stmt = ast.body[0]
    if (stmt.type === 'ImportDeclaration') {
      manager.hoisted.imports.push({
        node: stmt,
        magicString: hoistedMagicString,
      })
      return
    }
    if (stmt.type === 'VariableDeclaration') {
      manager.hoisted.decls.push({
        node: stmt,
        magicString: hoistedMagicString,
      })
      return
    }
  }
  addLocalCode(manager, plugin, code, priority)
}

function resolveVariableDeclarations(fragments: Fragment<VariableDeclaration>[]) {
  let decls: Record<string, {
    properties: string[],
    identifier?: string,
    kind: string,
  }> = {}
  for (const { node, magicString } of fragments) {
    for (const decl of node.declarations) {
      if (decl.init) {
        const init = magicString.sliceNode(decl.init)
        const left = decl.id
        if (left.type === 'ObjectPattern') {
          for (const property of left.properties) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!decls[init]) {
              decls[init] = { properties: [], kind: 'const' }
            }
            const propertyCode = magicString.sliceNode(property)
            if (!decls[init].properties.includes(propertyCode)) {
              decls[init].properties.push(propertyCode)
            }
            if (node.kind === 'let') {
              decls[init].kind = node.kind
            }
          }
        } else if (left.type === 'Identifier') {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!decls[init]) {
            decls[init] = { properties: [], kind: 'const' }
          }
          decls[init].identifier = resolveString(left)
          if (node.kind === 'let') {
            decls[init].kind = node.kind
          }
        }
      }
    }
  }
  return decls
}

function resolveImportDeclarations(fragments: Fragment<ImportDeclaration>[]) {
  const imports: Record<string, {
    specifiers: string[],
    defaultSpecifier?: string,
    namespaceSpecifier?: string,
  }> = {}
  for (const { node } of fragments) {
    for (const specifier of node.specifiers) {
      const source = resolveString(node.source)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!imports[source]) {
        imports[source] = { specifiers: [] }
      }
      switch (specifier.type) {
        case 'ImportNamespaceSpecifier':
          imports[source].namespaceSpecifier = resolveString(specifier.local)
          break
        case 'ImportDefaultSpecifier':
          imports[source].defaultSpecifier = resolveString(specifier.local)
          break
        default: {
          const local = resolveString(specifier.local)
          const exportName = resolveString(specifier.imported)
          const specifierCode = local === exportName ? local : `${exportName} as ${local}`
          if (!imports[source].specifiers.includes(specifierCode)) {
            imports[source].specifiers.push(specifierCode)
          }
          break
        }
      }
    }
  }
  return imports
}

export function generateLocalCode(local: PluginCodeManager['local']) {
  return sortBy(
    Array.from(local.values()),
    data => (data.lines.length ? data.priority / data.lines.length : 0),
  ).flatMap(data => {
    return data.lines.length ? [data.lines.join('\n')] : []
  }).join('\n\n')
}

export function generateHoistedCode(ast: Program, magicString: MagicStringAST, hoisted: PluginCodeManager['hoisted']) {
  // 1. imports
  const imports = resolveImportDeclarations(hoisted.imports)
  let importCode: string[] = []
  let declCode: string[] = []
  for (const [source, decl] of Object.entries(imports)) {
    const existingNodes = ast.body.filter(
      (node): node is ImportDeclaration => node.type === 'ImportDeclaration'
        && (!node.importKind || node.importKind === 'value')
        && resolveString(node.source) === source,
    )
    const existingDecl = (
      resolveImportDeclarations(existingNodes.map(node => ({ node, magicString }))) as Partial<typeof imports>
    )[source]
    if (decl.namespaceSpecifier) {
      if (existingDecl?.namespaceSpecifier) {
        if (existingDecl.namespaceSpecifier !== decl.namespaceSpecifier) {
          declCode.push(`const ${decl.namespaceSpecifier} = ${existingDecl.namespaceSpecifier}`)
        }
      } else {
        importCode.push(`import * as ${decl.namespaceSpecifier} from '${source}'`)
      }
    }
    // TODO: merge default specifier and specifiers
    if (decl.defaultSpecifier) {
      if (existingDecl?.defaultSpecifier) {
        if (existingDecl.defaultSpecifier !== decl.defaultSpecifier) {
          declCode.push(`const ${decl.defaultSpecifier} = ${existingDecl.defaultSpecifier}`)
        }
      } else {
        importCode.push(`import ${decl.defaultSpecifier} from '${source}'`)
      }
    }
    const missingSpecifiers = existingDecl ? decl.specifiers.filter(
      specifierCode => !existingDecl.specifiers.includes(specifierCode),
    ) : decl.specifiers
    if (missingSpecifiers.length) {
      const missingSpecifierCode = missingSpecifiers.map(name => `${name}`).join(', ')
      const reusableNode = existingNodes.find(node => node.specifiers.some(item => item.type === 'ImportSpecifier'))
      if (reusableNode) {
        magicString.appendLeft(
          reusableNode.specifiers.at(-1)!.end!,
          ', ' + missingSpecifierCode,
        )
      } else {
        importCode.push(`import { ${missingSpecifierCode} } from '${source}'`)
      }
    }
  }
  // 2. decls
  const decls = resolveVariableDeclarations(hoisted.decls)
  declCode = declCode.concat(Object.entries(decls).flatMap(([init, decl]) => {
    let currentLines: string[] = []
    if (decl.identifier) {
      currentLines.push(`${decl.kind} ${decl.identifier} = ${init}`)
      if (decl.properties.length) {
        currentLines.push(`${decl.kind} {\n${decl.properties.map(varName => `  ${varName},\n`).join('')}} = ${decl.identifier}`)
      }
    } else if (decl.properties.length) {
      currentLines.push(`${decl.kind} {\n${decl.properties.map(varName => `  ${varName},\n`).join('')}} = ${init}`)
    }
    return currentLines
  }))
  // 3. combine
  const lastImports = getLastImports(ast)
  return [...importCode, ...((lastImports || importCode.length) && declCode.length ? [''] : []), ...declCode].join('\n')
}

function regenerate<T, U>(generator: Generator<T, U, unknown>) {
  const result = {
    *run() {
      result.value = yield* generator
    },
    value: undefined as U,
  }
  return result
}

export function transformOptions(
  optionsObject: ObjectExpression['properties'],
  magicString: MagicStringAST,
  options: TransformOptions,
) {
  const manager = createPluginCodeManager()
  let instanceProperties: Property[] = []
  const optionProperties = optionsObject.reduce<typeof optionsObject>(
    (preserved, property) => {
      if ((
        property.type === 'ObjectProperty'
        || property.type === 'ObjectMethod'
      ) && (
        property.key.type === 'Identifier'
        || isLiteralType(property.key)
      )) {
        const name = resolveString(property.key)
        const node = getPropertyValue(property)
        const context = { name, node, magicString, options }
        const matchedPlugins = options.plugins.filter(plugin => plugin.transformInclude?.(context) && plugin.transform)
        let replacement: string | false = matchedPlugins.length ? '' : false
        for (const plugin of matchedPlugins) {
          const helpers: TransformHelpers = { factory, transform: undefined as never }
          helpers.transform = (anotherNode) => plugin.transform!({ ...context, node: anotherNode }, helpers)
          const generator = regenerate(plugin.transform!(context, helpers))
          for (const item of generator.run()) {
            switch (item.type) {
              case 'LocalCode':
                addLocalCode(manager, plugin, item.content, item.priority)
                break
              case 'HoistedCode':
                addHoistedPluginCode(manager, plugin, item.content, item.priority)
                break
              case 'Property':
                instanceProperties.push(item)
                break
            }
          }
          if (generator.value !== undefined) {
            replacement = generator.value
          }
        }
        if (replacement !== false) {
          return preserved
        }
      }
      preserved.push(property)
      return preserved
    },
    [],
  )
  return {
    local: manager.local,
    hoisted: manager.hoisted,
    instanceProperties,
    optionProperties,
  }
}

export function transformThisProperties(
  ast: Program,
  magicString: MagicStringAST,
  properties: Property[],
  options: TransformOptions,
) {
  const manager = createPluginCodeManager()
  const matchedPlugins = options.plugins.filter(plugin => plugin.visitProperty)
  if (matchedPlugins.length) {
    visitNode(ast, [], (node, path) => {
      if (node.type === 'MemberExpression' && node.object.type === 'ThisExpression' && (
        node.property.type === 'Identifier'
        || isLiteralType(node.property)
      )) {
        const name = resolveString(node.property)
        const source = properties.find(item => item.name === name)?.source
        const context = { name, node, path, magicString, source }
        const helpers = { factory }
        let replacement: string | false = false
        for (const plugin of matchedPlugins) {
          const generator = regenerate(plugin.visitProperty!(context, helpers))
          for (const item of generator.run()) {
            switch (item.type) {
              case 'LocalCode':
                addLocalCode(manager, plugin, item.content, item.priority)
                break
              case 'HoistedCode':
                addHoistedPluginCode(manager, plugin, item.content, item.priority)
                break
            }
          }
          if (generator.value !== undefined) {
            replacement = generator.value
            if (source === undefined) {
              context.source = plugin
            }
          }
        }
        if (replacement !== false) {
          magicString.overwriteNode(node, replacement)
        }
      }
    })
  }
  return {
    local: manager.local,
    hoisted: manager.hoisted,
  }
}

export function appendOptions(defineOptions: ObjectExpression, magicString: MagicStringAST, properties: ObjectExpression['properties'], sourceMagicString: MagicStringAST) {
  magicString.appendLeft(
    defineOptions.properties.at(-1)!.end!,
    properties.map(property => `,\n  ${sourceMagicString.sliceNode(property)}`).join(''),
  )
}

export function createDefineOptions(properties: ObjectExpression['properties'], magicString: MagicStringAST) {
  return `defineOptions({\n${properties.map(property => `  ${magicString.sliceNode(property)},\n`).join('')}})`
}

export function createSetupReturn(properties: Property[]) {
  return `return {\n${
    properties
      .filter(property => property.exposed)
      .map(property => `  ${property.name},\n`)
      .join('')
  }}`
}

export function createExportOptions(properties: ObjectExpression['properties'], magicString: MagicStringAST, code: string) {
  return `export default {\n${[
    ...properties.map(property => `  ${magicString.sliceNode(property)},`),
    `  setup(props, { attrs, slots, emit, expose }) {\n${code.split('\n').map(line => (line ? `    ${line}` : line)).join('\n')}\n  },`,
  ].join('\n')}\n}`
}

function getLastImports(ast: Program) {
  return ast.body.findLast((node): node is ImportDeclaration => node.type === 'ImportDeclaration')
}

export function insertLocalCode(ast: Program, magicString: MagicStringAST, code: string) {
  if (code) {
    const lastImports = getLastImports(ast)
    if (lastImports) {
      magicString.appendRight(lastImports.end!, `\n\n${code}`)
    } else {
      magicString.appendRight(0, `\n${code}\n`)
    }
  }
}

export function insertHoistedCode(ast: Program, magicString: MagicStringAST, code: string) {
  if (code) {
    const lastImports = getLastImports(ast)
    if (lastImports) {
      magicString.prependRight(lastImports.end!, `\n${code}`)
    } else {
      magicString.prependRight(0, `\n${code}\n`)
    }
  }
}

export function replaceWithCode(node: Node | Node[], magicString: MagicStringAST, code: string) {
  magicString.overwriteNode(node, code)
}

export function getProperties(node: ObjectExpression) {
  const result: Record<string, ObjectPropertyValueLike> = {}
  for (const property of node.properties) {
    if ((
      property.type === 'ObjectProperty'
      || property.type === 'ObjectMethod'
    ) && (
      property.key.type === 'Identifier'
      || isLiteralType(property.key)
    )) {
      const name = resolveString(property.key)
      result[name] = getPropertyValue(property)
    }
  }
  return result
}

export function splitFunctionBody(block: BlockStatement) {
  const stmts = block.body
  const returnStmt = stmts.find((child): child is ReturnStatement => child.type === 'ReturnStatement')
  if (!returnStmt) return undefined
  const stmtsBefore = stmts.slice(0, stmts.indexOf(returnStmt))
  return [returnStmt, stmtsBefore] as const
}
