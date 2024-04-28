export function dedent(code: string) {
  const matches = code.match(/\n */g)
  if (matches) {
    const validItems = matches.filter(
      (value, index, array) => (value.length > 1 || index === array.length - 1),
    )
    if (validItems.length) {
      const base = Math.min(...validItems.map(value => value.length - 1))
      return code.replace(new RegExp(`\\n {${base}}`, 'g'), '\n')
    }
  }
  return code
}

export function indent(code: string, indentation: number) {
  return code.replace(/\n(?!\n)/, '\n' + ' '.repeat(indentation))
}
