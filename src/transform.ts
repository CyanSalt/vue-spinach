import type { CallExpression, ExportDefaultDeclaration, ExpressionStatement, ImportDeclaration, Node, ObjectExpression, ObjectMethod, ObjectProperty, Program } from '@babel/types'
import { isIdentifierOf, isLiteralType, resolveString } from 'ast-kit'
import type { MagicStringAST } from 'magic-string-ast'
import { visitNode } from './ast'
import type { Plugin, ThisProperty, TransformHelpers } from './plugin'
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

function getPropertyValue(node: ObjectProperty | ObjectMethod): ObjectPropertyValueLike {
  return node.type === 'ObjectProperty' ? node.value : node
}

export function transformOptions(
  options: ObjectExpression['properties'],
  magicString: MagicStringAST,
  plugins: Plugin[],
) {
  let code: string[] = []
  let thisProperties: ThisProperty[] = []
  let imports: Record<string, string[]> = {}
  const properties = options.reduce<typeof options>(
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
        const context = { name, node, magicString }
        const matchedPlugins = plugins.filter(plugin => plugin.transformInclude?.(context) && plugin.transform)
        for (const plugin of matchedPlugins) {
          let lines: string[] = []
          const helpers = { factory } as TransformHelpers
          helpers.transform = (anotherNode) => plugin.transform!({ ...context, node: anotherNode }, helpers)
          for (const item of plugin.transform!(context, helpers)) {
            switch (item.type) {
              case 'Code':
                lines.push(item.content)
                break
              case 'Import':
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!imports[item.from]) {
                  imports[item.from] = []
                }
                imports[item.from].push(item.imported)
                break
              case 'ThisProperty':
                thisProperties.push(item)
                break
            }
          }
          if (lines.length) {
            code.push(lines.join('\n'))
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
    code,
    imports,
    thisProperties,
    properties,
  }
}

export function transformThisProperties(
  ast: Program,
  magicString: MagicStringAST,
  properties: ThisProperty[],
  plugins: Plugin[],
) {
  let imports: Record<string, string[]> = {}
  const matchedPlugins = plugins.filter(plugin => plugin.visitProperty)
  if (matchedPlugins.length) {
    visitNode(ast, node => {
      if (node.type === 'MemberExpression' && node.object.type === 'ThisExpression' && (
        node.property.type === 'Identifier'
        || isLiteralType(node.property)
      )) {
        const name = resolveString(node.property)
        const context = { name, node, magicString, properties }
        const helpers = { factory }
        let code: string | undefined
        for (const plugin of matchedPlugins) {
          for (const item of plugin.visitProperty!(context, helpers)) {
            switch (item.type) {
              case 'Code':
                code = item.content
                break
              case 'Import':
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!imports[item.from]) {
                  imports[item.from] = []
                }
                imports[item.from].push(item.imported)
                break
            }
          }
        }
        if (code !== undefined) {
          magicString.overwriteNode(node, code)
        }
      }
    })
  }
  return {
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
        && node.importKind === 'value'
        && resolveString(node.source) === source,
    )
    if (decls.length) {
      const importedSpecifiers = decls.flatMap(decl => decl.specifiers)
      const missingSpecifiers = specifiers.filter(name => !importedSpecifiers.some(item => item.local.name === name))
      if (missingSpecifiers.length) {
        magicString.overwriteNode(
          decls[0].specifiers,
          magicString.sliceNode(decls[0].specifiers)
            + missingSpecifiers.map(name => `, ${name}`),
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
