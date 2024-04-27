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
  imports: Fragment<ImportDeclaration>[],
  local: Map<Plugin, {
    lines: string[],
    decls: Fragment<VariableDeclaration>[],
    priority: number,
  }>,
}

function createPluginCodeManager(): PluginCodeManager {
  return {
    imports: [],
    local: new Map(),
  }
}

function getPluginCodeLocalData(manager: PluginCodeManager, plugin: Plugin) {
  if (!manager.local.has(plugin)) {
    manager.local.set(plugin, { lines: [], decls: [], priority: 0 })
  }
  return manager.local.get(plugin)!
}

function addPluginCode(manager: PluginCodeManager, plugin: Plugin, code: string, priority: number) {
  const data = getPluginCodeLocalData(manager, plugin)
  data.lines.push(code)
  data.priority += priority
}

function addHoistedPluginCode(manager: PluginCodeManager, plugin: Plugin, code: string, priority: number) {
  const data = getPluginCodeLocalData(manager, plugin)
  const { ast, magicString: hoistedMagicString } = parseScript(code)
  if (ast.body.length === 1) {
    const stmt = ast.body[0]
    if (stmt.type === 'ImportDeclaration') {
      manager.imports.push({
        node: stmt,
        magicString: hoistedMagicString,
      })
      return
    }
    if (stmt.type === 'VariableDeclaration') {
      data.decls.push({
        node: stmt,
        magicString: hoistedMagicString,
      })
      return
    }
  }
  addPluginCode(manager, plugin, code, priority)
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

function generateLocalPluginCode(local: PluginCodeManager['local']) {
  return sortBy(
    Array.from(local.values()),
    data => (data.lines.length ? data.priority / data.lines.length : 0),
  ).map(data => {
    const decls = resolveVariableDeclarations(data.decls)
    const codeLines = [
      ...Object.entries(decls).flatMap(([init, decl]) => {
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
      }),
      ...data.lines,
    ]
    return codeLines.join('\n')
  })
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
          for (const item of plugin.transform!(context, helpers)) {
            switch (item.type) {
              case 'Code':
                addPluginCode(manager, plugin, item.content, item.priority)
                break
              case 'HoistedCode':
                addHoistedPluginCode(manager, plugin, item.content, item.priority)
                break
              case 'Replacement':
                replacement = item.content
                break
              case 'Property':
                instanceProperties.push(item)
                break
            }
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
    code: generateLocalPluginCode(manager.local),
    imports: manager.imports,
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
    visitNode(ast, node => {
      if (node.type === 'MemberExpression' && node.object.type === 'ThisExpression' && (
        node.property.type === 'Identifier'
        || isLiteralType(node.property)
      )) {
        const name = resolveString(node.property)
        const source = properties.find(item => item.name === name)?.source
        const context = { name, node, magicString, source }
        const helpers = { factory }
        let replacement: string | false = false
        for (const plugin of matchedPlugins) {
          for (const item of plugin.visitProperty!(context, helpers)) {
            switch (item.type) {
              case 'Code':
                addPluginCode(manager, plugin, item.content, item.priority)
                break
              case 'HoistedCode':
                addHoistedPluginCode(manager, plugin, item.content, item.priority)
                break
              case 'Replacement':
                replacement = item.content
                break
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
    code: generateLocalPluginCode(manager.local),
    imports: manager.imports,
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

export function prependStatements(ast: Program, magicString: MagicStringAST, code: string[]) {
  const lastImports = getLastImports(ast)
  if (lastImports) {
    magicString.appendLeft(lastImports.end!, code.map(statement => `\n\n${statement}`).join(''))
  } else {
    magicString.appendLeft(0, code.map(statement => `${statement}\n\n`).join(''))
  }
}

export function replaceStatements(node: Node | Node[], magicString: MagicStringAST, code: string[]) {
  magicString.overwriteNode(node, code.join('\n\n'))
}

export function addImportDeclarations(ast: Program, magicString: MagicStringAST, fragments: PluginCodeManager['imports']) {
  const imports = resolveImportDeclarations(fragments)
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
  const code = [...importCode, ...(declCode.length ? ['', ...declCode] : declCode)]
  const lastImports = getLastImports(ast)
  if (code.length) {
    if (lastImports) {
      magicString.appendLeft(lastImports.end!, code.map(line => `\n${line}`).join(''))
    } else {
      magicString.appendLeft(0, code.map(line => `\n${line}`).join('') + '\n')
    }
  }
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
