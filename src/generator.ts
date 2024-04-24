import type { SFCBlock, SFCDescriptor } from '@vue/compiler-sfc'

function createOpenTag(block: SFCBlock) {
  return `<${block.type}${Object.entries(block.attrs).map(([name, value]) => {
    return value === true ? ` ${name}` : ` ${name}="${value}"`
  }).join('')}>`
}

function createCloseTag(block: SFCBlock) {
  return `</${block.type}>`
}

function generateCodeForBlock(block: SFCBlock) {
  const openTag = createOpenTag(block)
  const closeTag = createCloseTag(block)
  return `${openTag}${block.content}${closeTag}`
}

export function generateCode(descriptor: SFCDescriptor) {
  const code = (
    descriptor.scriptSetup ? generateCodeForBlock(descriptor.scriptSetup) + '\n\n' : ''
  ) + (
    descriptor.template ? generateCodeForBlock(descriptor.template) + '\n\n' : ''
  ) + (
    descriptor.script ? generateCodeForBlock(descriptor.script) + '\n\n' : ''
  ) + (
    descriptor.styles.map(style => generateCodeForBlock(style) + '\n\n').join('')
  )
  return code.trim() + '\n'
}
