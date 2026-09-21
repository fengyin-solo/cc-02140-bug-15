// Node ESM loader：解析 Vite 的 @/ 别名，并把图片资源转为空模块（仅测试用）
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import path from 'node:path'

const SRC_DIR = path.resolve(process.cwd(), 'src')

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const candidate = path.join(SRC_DIR, specifier.slice(2))
    for (const ext of ['', '.js', '.vue', '.json']) {
      if (existsSync(candidate + ext)) {
        return { url: pathToFileURL(candidate + ext).href, shortCircuit: true }
      }
    }
  }
  // 兜底相对路径无扩展名导入（如 ./borrow -> ./borrow.js）
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const candidate = new URL(specifier, context.parentURL)
    if (!path.extname(candidate.pathname)) {
      for (const ext of ['.js', '.vue', '.json']) {
        if (existsSync(candidate.pathname + ext)) {
          return {
            url: pathToFileURL(candidate.pathname + ext).href,
            shortCircuit: true
          }
        }
      }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (/\.(webp|jpeg|jpg|png|svg|gif)$/.test(new URL(url).pathname)) {
    return { format: 'module', source: 'export default ""', shortCircuit: true }
  }
  return nextLoad(url, context)
}
