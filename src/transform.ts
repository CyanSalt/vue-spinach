import type { BlockStatement, CallExpression, ExportDefaultDeclaration, ExpressionStatement, ImportDeclaration, Node, ObjectExpression, ObjectMethod, ObjectProperty, Program, ReturnStatement } from '@babel/types'
import { isIdentifierOf, isLiteralType, resolveString } from 'ast-kit'
import { sortBy } from 'lodash-es'
import type { MagicStringAST } from 'magic-string-ast'
import { visitNode } from './ast'
import type { Code, Declaration, Plugin, ThisProperty, TransformHelpers, TransformOptions } from './plugin'
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

type PluginCodeManager = Map<Plugin, {
  lines: string[],
  decls: Record<string, {
    name?: string,
    names: string[],
    constant: boolean,
  }>,
  priority: number,
}>

function createPluginCodeManager(): PluginCodeManager {
  return new Map<Plugin, {
    lines: string[],
    decls: Record<string, {
      name?: string,
      names: string[],
      constant: boolean,
    }>,
    priority: 0,
  }>()
}

function addCodeLine(manager: PluginCodeManager, plugin: Plugin, item: Code) {
  if (!manager.has(plugin)) {
    manager.set(plugin, { lines: [], decls: {}, priority: 0 })
  }
  const data = manager.get(plugin)!
  data.lines.push(item.content)
  data.priority += item.priority
}

function addCodeDeclaration(manager: PluginCodeManager, plugin: Plugin, item: Declaration) {
  if (!manager.has(plugin)) {
    manager.set(plugin, { lines: [], decls: {}, priority: 0 })
  }
  const data = manager.get(plugin)!
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!data.decls[item.from]) {
    data.decls[item.from] = { names: [], constant: true }
  }
  if (!item.destructure) {
    data.decls[item.from].name = item.name
  } else if (!data.decls[item.from].names.includes(item.name)) {
    data.decls[item.from].names.push(item.name)
  }
  if (!item.constant) {
    data.decls[item.from].constant = false
  }
}

function generateCode(manager: PluginCodeManager) {
  return sortBy(
    Array.from(manager.values()),
    data => (data.lines.length ? data.priority / data.lines.length : 0),
  ).map(data => {
    const codeLines = [
      ...Object.entries(data.decls).flatMap(([declSource, decl]) => {
        let currentLines: string[] = []
        if (decl.name) {
          currentLines.push(`${decl.constant ? 'const' : 'let'} ${decl.name} = ${declSource}`)
          if (decl.names.length) {
            currentLines.push(`${decl.constant ? 'const' : 'let'} {\n${decl.names.map(varName => `  ${varName},\n`).join('')}} = ${decl.name}`)
          }
        } else if (decl.names.length) {
          currentLines.push(`${decl.constant ? 'const' : 'let'} {\n${decl.names.map(varName => `  ${varName},\n`).join('')}} = ${declSource}`)
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
  let imports: Record<string, string[]> = {}
  let thisProperties: ThisProperty[] = []
  const properties = optionsObject.reduce<typeof optionsObject>(
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
        for (const plugin of matchedPlugins) {
          const helpers: TransformHelpers = { factory, transform: undefined as never }
          helpers.transform = (anotherNode) => plugin.transform!({ ...context, node: anotherNode }, helpers)
          for (const item of plugin.transform!(context, helpers)) {
            switch (item.type) {
              case 'Code':
                addCodeLine(manager, plugin, item)
                break
              case 'Import': {
                const importSource = options.aliases[item.from] ?? item.from
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!imports[importSource]) {
                  imports[importSource] = []
                }
                if (!imports[importSource].includes(item.imported)) {
                  imports[importSource].push(item.imported)
                }
                break
              }
              case 'Declaration':
                addCodeDeclaration(manager, plugin, item)
                break
              case 'ThisProperty':
                thisProperties.push(item)
                break
            }
          }
        }
        if (matchedPlugins.length) {
          return preserved
        }
      }
      preserved.push(property)
      return preserved
    },
    [],
  )
  return {
    code: generateCode(manager),
    imports,
    thisProperties,
    properties,
  }
}

export function transformThisProperties(
  ast: Program,
  magicString: MagicStringAST,
  thisProperties: ThisProperty[],
  options: TransformOptions,
) {
  const manager = createPluginCodeManager()
  let imports: Record<string, string[]> = {}
  const matchedPlugins = options.plugins.filter(plugin => plugin.visitProperty)
  if (matchedPlugins.length) {
    visitNode(ast, node => {
      if (node.type === 'MemberExpression' && node.object.type === 'ThisExpression' && (
        node.property.type === 'Identifier'
        || isLiteralType(node.property)
      )) {
        const name = resolveString(node.property)
        const source = thisProperties.find(item => item.name === name)?.source
        const context = { name, node, magicString, source }
        const helpers = { factory }
        let replacement: string | undefined
        for (const plugin of matchedPlugins) {
          for (const item of plugin.visitProperty!(context, helpers)) {
            switch (item.type) {
              case 'Code':
                addCodeLine(manager, plugin, item)
                break
              case 'Import': {
                const importSource = options.aliases[item.from] ?? item.from
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!imports[importSource]) {
                  imports[importSource] = []
                }
                if (!imports[importSource].includes(item.imported)) {
                  imports[importSource].push(item.imported)
                }
                break
              }
              case 'Declaration':
                addCodeDeclaration(manager, plugin, item)
                break
              case 'Replacement':
                replacement = item.content
                break
            }
          }
        }
        if (replacement !== undefined) {
          magicString.overwriteNode(node, replacement)
        }
      }
    })
  }
  return {
    code: generateCode(manager),
    imports,
  }
}

export function appendOptions(defineOptions: ObjectExpression, magicString: MagicStringAST, properties: ObjectExpression['properties'], sourceMagicString: MagicStringAST) {
  magicString.overwriteNode(
    defineOptions.properties,
    magicString.sliceNode(defineOptions.properties)
      + properties.map(property => `,\n  ${sourceMagicString.sliceNode(property)}`).join(''),
  )
}

export function createDefineOptions(properties: ObjectExpression['properties'], magicString: MagicStringAST) {
  return `defineOptions({\n${properties.map(property => `  ${magicString.sliceNode(property)},`).join('\n')}\n})`
}

export function createSetupReturn(properties: ThisProperty[]) {
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
    `  setup(props) {\n${code.split('\n').map(line => (line ? `    ${line}` : line)).join('\n')}\n  },`,
  ].join('\n')}\n}`
}

function getLastImports(ast: Program) {
  return ast.body.findLast((node): node is ImportDeclaration => node.type === 'ImportDeclaration')
}

function insertStatementsAfter(node: Node | Node[], magicString: MagicStringAST, code: string[]) {
  magicString.overwriteNode(
    node,
    magicString.sliceNode(node)
      + code.map(statement => `\n\n${statement}`).join(''),
  )
}

function insertStatementsAtFirst(magicString: MagicStringAST, code: string[]) {
  magicString.prepend(code.map(statement => `${statement}\n\n`).join(''))
}

export function prependStatements(ast: Program, magicString: MagicStringAST, code: string[]) {
  const lastImports = getLastImports(ast)
  if (lastImports) {
    insertStatementsAfter(lastImports, magicString, code)
  } else {
    insertStatementsAtFirst(magicString, code)
  }
}

export function replaceStatements(node: Node | Node[], magicString: MagicStringAST, code: string[]) {
  magicString.overwriteNode(node, code.join('\n\n'))
}

export function addImports(ast: Program, magicString: MagicStringAST, imports: Record<string, string[]>) {
  const code: string[] = []
  for (const [source, specifiers] of Object.entries(imports)) {
    const decls = ast.body.filter(
      (node): node is ImportDeclaration => node.type === 'ImportDeclaration'
        && node.importKind !== 'type' // maybe undefined
        && resolveString(node.source) === source,
    )
    if (decls.length) {
      const importedSpecifiers = decls.flatMap(decl => decl.specifiers)
      const missingSpecifiers = specifiers.filter(name => !importedSpecifiers.some(item => item.local.name === name))
      if (missingSpecifiers.length) {
        magicString.overwriteNode(
          decls[0].specifiers,
          magicString.sliceNode(decls[0].specifiers)
            + missingSpecifiers.map(name => `, ${name}`).join(''),
        )
      }
    } else {
      code.push(`import { ${specifiers.join(', ')} } from '${source}'`)
    }
  }
  if (code.length) {
    magicString.prepend('\n' + code.join('\n') + (getLastImports(ast) ? '' : '\n'))
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
