export interface TransformOptions {
  format: 'composition' | 'option',
  scriptSetup?: boolean,
  reactivityTransform?: boolean,
}

export function transformSFC(code: string, options: TransformOptions) {
  return code
}
