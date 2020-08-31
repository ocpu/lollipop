import { ResponseProvider } from './router.ts'

export function isDenoReader(obj: any): obj is Deno.Reader {
  return typeof obj === 'object' && obj !== null && typeof obj.read === 'function' && obj.read.length === 1
}

export function isResponseProvider(obj: any): obj is ResponseProvider {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.provideResponse === 'function'
  )
}

export function getPathname(url: string) {
  const queryIndex = url.indexOf('?')
  if (queryIndex !== -1) return url.slice(0, queryIndex)
  else return url
}

export interface ParsedQuery {
  [name: string]: string | string[]
}

export function getParsedQuery(url: string): ParsedQuery {
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return {}
  const query = url.substring(queryIndex + 1)
  const result: ParsedQuery = {}
  for (const [key, value] of query.split('&').map(it => it.split('='))) {
    if (key === '') continue
    const decodedKey = decodeURIComponent(key)
    if (!(decodedKey in result)) {
      result[decodedKey] = decodeURIComponent(value)
    } else {
      let existingValue = result[decodedKey]
      if (Array.isArray(existingValue)) {
        existingValue.push(decodeURIComponent(value))
      } else {
        result[decodedKey] = [existingValue, decodeURIComponent(value)]
      }
    }
  }
  return result
}

export function joinPaths(path1: string, path2: string): string {
  if (path1.endsWith('/')) {
    if (path2.startsWith('/')) return path1 + path2.slice(1)
    else return path1 + path2
  } else {
    if (path2.startsWith('/')) return path1 + path2
    else return path1 + '/' + path2
  }
}

export function comparePaths(template: string, url: string): string[] | false {
  const templateSplit = template.split('/')
  if (templateSplit[0] === '') templateSplit.shift()
  if (templateSplit[templateSplit.length - 1] === '') templateSplit.pop()
  const urlSplit = url.split('/')
  if (urlSplit[0] === '') urlSplit.shift()
  if (urlSplit[urlSplit.length - 1] === '') urlSplit.pop()
  if (templateSplit.length !== urlSplit.length) return false
  const params: string[] = []
  for (let i = 0; i < templateSplit.length; i++) {
    if (templateSplit[i].startsWith(':')) {
      params.push(urlSplit[i])
      continue
    }
    if (templateSplit[i] !== urlSplit[i]) return false
  }
  return params
}

