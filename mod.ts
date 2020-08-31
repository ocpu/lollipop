import { acceptWebSocket, WebSocket, WebSocketEvent } from 'https://deno.land/std/ws/mod.ts'
import Router, { HandlerContext, HandleSuccess, PRE_CONDITION_FAILED, ResponseType } from './router.ts'
import Application from './Application.ts'
import HTTPError from './HTTPError.ts'
import { ServerRequest } from 'https://deno.land/std@0.65.0/http/server.ts'
import { getPathname, joinPaths } from './util.ts'
import { resolve } from "https://deno.land/std@0.66.0/path/mod.ts"

declare global {
  namespace Lollipop {
    // The interfaces here are for extensions so that they can extend the handler context
    // when handling them in a route handler.
    interface HandlerContext {}
  }
}

export { default as Router, ResponseType, ResponseProvider as ResponseContainer } from './router.ts'
export { Extension, ServerRequest, HandlerContext } from './extension.ts'

export function createServer(developmentMode?: boolean) {
  return new Application(developmentMode ?? false)
}

/**
 * Create a new router
 */
export function createRouter() {
  return new Router()
}

/**
 * Serves files from the specified path
 * Requires `allow-read` permission.
 * @param path
 *
 */
export function serveDirectory(
  path: string,
  directoryListing?: boolean | ((path: string, ctx: HandlerContext) => ResponseType)
) {
  return new DirectoryRouter(
    path,
    typeof directoryListing === 'boolean'
      ? DirectoryRouter.defaultDirectoryListing
      : typeof directoryListing === 'function'
      ? directoryListing
      : undefined
  )
}

export function errorBadRequest(message?: string, cause?: Error): HTTPError {
  return new HTTPError(message ?? 'Bad Request', 400, cause)
}

export function errorUnauthorized(message?: string, cause?: Error): HTTPError {
  return new HTTPError(message ?? 'Unauthorized', 401, cause)
}

export function websocket(handler: (websocket: WebSocket) => void | Promise<void>) {
  const connections: WebSocket[] = []
  return (ctx: HandlerContext) => {
    if (ctx.method !== 'GET') throw new HTTPError('Developer Error: Websocket method must be GET')
    if (ctx.headers.get('connection') !== 'Upgrade')
      throw new HTTPError(
        'This is a websocket endpoint and requires the connection to be upgraded: Missing header Connection: Upgrade',
        400
      )
    if (ctx.headers.get('upgrade') !== 'websocket')
      throw new HTTPError(
        'This is a websocket endpoint and requires the connection to be upgraded: Missing header Upgrade: websocket',
        400
      )
    return acceptWebSocket(ctx).then(ws => {
      connections.push(ws)
      handler(ws)
      ctx.done.then(() => connections.splice(connections.indexOf(ws)))
    })
  }
}

class DirectoryRouter extends Router {
  constructor(
    public readonly path: string,
    public readonly directoryListing?: (path: string, ctx: HandlerContext) => ResponseType
  ) {
    super()
  }

  async handle(req: ServerRequest, ctx: HandlerContext) {
    const templateSplit = this.baseURL.split('/')
    if (templateSplit[0] === '') templateSplit.shift()
    if (templateSplit[templateSplit.length - 1] === '') templateSplit.pop()

    const urlSplit = req.url.split('/')
    if (urlSplit[0] === '') urlSplit.shift()
    if (urlSplit[urlSplit.length - 1] === '') urlSplit.pop()

    for (let i = 0; i < templateSplit.length; i++) {
      if (templateSplit[i].startsWith(':') || templateSplit[i] === urlSplit[i]) {
        continue
      }
      return PRE_CONDITION_FAILED
    }

    const pathSections = urlSplit.slice(templateSplit.length)
    const pathBound = []
    let level = 0
    for (const section of pathSections) {
      if (section === '..') {
        level--
        if (pathBound.length) pathBound.pop()
      } else {
        if (level >= 0) pathBound.push(section)
        level++
      }
    }
    if (level < 0) return PRE_CONDITION_FAILED
    const pathResult = resolve(this.path, ...pathBound)
    const stat = await Deno.stat(pathResult)
    if (stat.isDirectory) {
      if (this.directoryListing) {
        const entries = []
        for await (const entry of Deno.readDir(pathResult))
          entries.push(entry)
        return new HandleSuccess(await this.directoryListing(pathResult, ctx))
      } else {
        return PRE_CONDITION_FAILED
      }
    } else {
      const eTag = req.headers.get('etag')?.replace(/(?:W\/)"[^"]*"/, '$1')
      if (!eTag) {
        return new HandleSuccess(Deno.read)
      }
    }
  }

  static defaultDirectoryListing = (path: string, ctx: HandlerContext): ResponseType => ''
}
