import { Response, ServerRequest } from 'https://deno.land/std/http/server.ts'
import { BufReader, BufWriter } from "https://deno.land/std/io/bufio.ts"
import { comparePaths, getPathname, joinPaths } from './util.ts'

class HandleResult {}
export const PRE_CONDITION_FAILED = new HandleResult()
export class HandleSuccess extends HandleResult {
  constructor(public value: ResponseType) {
    super()
  }
}

type HandlersResult = HandleResult | ResponseType

interface ServerRouteHandlerContext {
  readonly url: string
  readonly path: string
  readonly method: string
  readonly params: { readonly [name: string]: string }
  readonly headers: Headers
  readonly conn: Deno.Conn
  readonly body: Deno.Reader
  readonly done: Promise<Error | undefined>
  readonly bufReader: BufReader
  readonly bufWriter: BufWriter
  status(): number
  status(status: number): HandlerContext
  setHeader(name: string, value: string | string[]): HandlerContext
  appendHeader(name: string, value: string | string[]): HandlerContext
  setHeaders(headers: { [name: string]: string | string[] }): HandlerContext
  return<R extends ResponseType>(value: R): R
}

export interface HandlerContext extends ServerRouteHandlerContext, Lollipop.HandlerContext {}

export type ResponseType =
  | undefined
  | Uint8Array
  | Deno.Reader
  | string
  | number
  | any[]
  | object
  | null
  | ResponseProvider

export interface ResponseProvider {
  provideResponse(context: HandlerContext): ResponseType | Promise<ResponseType>
}

/**
 * A router
 */
export default class Router {
  protected baseURL: string = '/'
  private onURLUpdateListeners: ((baseURL: string) => void)[] = []
  private handlers: ((request: ServerRequest, context: HandlerContext) => Promise<ResponseType> | ResponseType)[] = []

  private updateBaseURL(baseURL: string) {
    this.baseURL = joinPaths(baseURL, this.baseURL)
    for (const listener of this.onURLUpdateListeners) listener(this.baseURL)
  }

  protected async handle(request: ServerRequest, context: HandlerContext): Promise<HandlersResult> {
    for (const handler of this.handlers) {
      const handlerResult = await handler(request, context)
      if (handlerResult instanceof HandleResult) {
        if (handlerResult instanceof HandleSuccess) return handlerResult
        else if (handlerResult === PRE_CONDITION_FAILED) continue
        else throw new Error('Unhandled result')
      } else {
        return new HandleSuccess(handlerResult)
      }
    }
    return PRE_CONDITION_FAILED
  }

  add(router: Router): this
  add(path: string, router: Router): this
  add(method: string, path: string, handler: (context: HandlerContext) => ResponseType): this
  add(method: string | Router, path?: string | Router, handler?: (context: HandlerContext) => ResponseType): this {
    if (method instanceof Router) {
      method.updateBaseURL(this.baseURL)
      this.onURLUpdateListeners.push(method.updateBaseURL)
      this.handlers.push(method.handle)
    } else if (path instanceof Router) {
      path.updateBaseURL(joinPaths(this.baseURL, method))
      this.onURLUpdateListeners.push(path.updateBaseURL)
      this.handlers.push(path.handle)
    } else if (path && typeof handler === 'function') {
      let url = joinPaths(this.baseURL, path)
      this.onURLUpdateListeners.push(baseURL => (url = joinPaths(baseURL, path)))
      this.handlers.push((req, ctx) => {
        if (req.method === method) {
          const parsedURL = getPathname(req.url)
          let params: false | string[]
          if ((params = comparePaths(url, parsedURL)) !== false) {
            const entries = url
              .split('/')
              .filter(it => it.startsWith(':'))
              .map((it, i) => [it.substring(1), (params as string[])[i]])
            //@ts-ignore Has to get the params from somewhere
            for (const [key, value] of entries) ctx.params[key] = value
            return new HandleSuccess(handler(ctx))
          } else {
            return PRE_CONDITION_FAILED
          }
        } else {
          return PRE_CONDITION_FAILED
        }
      })
    } else {
      throw new Error('Invalid add signature')
    }

    return this
  }

  get(path: string, handler: (context: HandlerContext) => ResponseType) {
    return this.add('GET', path, handler)
  }
  post(path: string, handler: (context: HandlerContext) => ResponseType) {
    return this.add('POST', path, handler)
  }
  put(path: string, handler: (context: HandlerContext) => ResponseType) {
    return this.add('PUT', path, handler)
  }
  delete(path: string, handler: (context: HandlerContext) => ResponseType) {
    return this.add('DELETE', path, handler)
  }
  patch(path: string, handler: (context: HandlerContext) => ResponseType) {
    return this.add('PATCH', path, handler)
  }
  head(path: string, handler: (context: HandlerContext) => ResponseType) {
    return this.add('HEAD', path, handler)
  }
}
