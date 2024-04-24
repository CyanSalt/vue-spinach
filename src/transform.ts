import type { CallExpression, ExportDefaultDeclaration, ExpressionStatement, ImportDeclaration, Node, ObjectExpression, Program } from '@babel/types'
import { isIdentifierOf, isLiteralType, resolveString } from 'ast-kit'
import type { MagicStringAST } from 'magic-string-ast'
import type { Plugin } from './plugin'

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

export function transformOptions(options: ObjectExpression['properties'], magicString: MagicStringAST, plugins: Plugin[]) {
  let generated: string[] = []
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
        const value = property.type === 'ObjectProperty' ? property.value : property.body
        const matchedPlugin = plugins.find(plugin => plugin.filter(name, value))
        if (matchedPlugin) {
          generated = generated.concat([...matchedPlugin.transform(value, magicString)])
          return preserved
        }
      }
      preserved.push(property)
      return preserved
    },
    [],
  )
  return {
    generated,
    properties,
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
