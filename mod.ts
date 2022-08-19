import HTTPError from './HTTPError.ts'
import { ApplicationMiddlewareFunction, IncomingRequestContext, createApp, RequestContext, ResponseContext } from "./app.ts";
import { createRouter, RouteHandler } from "./router.ts";
import * as Path from "https://deno.land/std@0.152.0/path/mod.ts"
import { serveFile } from "https://deno.land/std@0.152.0/http/file_server.ts"

export { createApp, setupApplictionsForTest } from './app.ts'
export { createRouter } from './router.ts'
export { default as React, default as h } from './basic-jsx.ts'
export type { ApplicationMiddleware, ApplicationMiddlewareFunction, Application, IApplicationMiddleware, IncomingRequestContext, RequestContext, ResponseContext, TestSetup } from './app.ts'
export type { CreateRouterOptions, IncomingRequestRouteContext, RouteHandler, Router } from './router.ts'

export interface IncomingRequestDirectoryContext extends Pick<IncomingRequestContext, 'request' | 'response'> {
  readonly fileSystemPath: string | URL
  readonly isRoot: boolean
}

type RoutesDefinition<BasePath extends string, Def extends RoutesDefinition<BasePath, Def>> = {
  [K in keyof Def]: K extends string ? RouteHandler<K, BasePath> : never
}

export function serve<RoutesDef extends RoutesDefinition<string, RoutesDef>>(routesDef: RoutesDef): Promise<void> {
  return createApp().use(createRouter().routes(routesDef)).serve()
}

/**
 * Serves files from the specified path
 * Requires `allow-read` permission.
 * @param path
 *
 */
export async function serveDirectory(
  path: string | URL,
  options?: {
    baseURL?: string
    directoryListing?: boolean | ((ctx: IncomingRequestDirectoryContext) => void | Promise<void>)
  }
): Promise<ApplicationMiddlewareFunction> {
  const fsBasePath = path instanceof URL ? path : new URL('file://' + path)

  if (fsBasePath.protocol !== 'file:') {
    throw new Error('The provided URL is not local')
  }

  if ((await Deno.permissions.query({ name: 'read', path: path })).state !== 'granted') {
    console.error('To be able to serve files from directory %s read access to that directory has to be granted.', path)
    if ((await Deno.permissions.request({ name: 'read', path: path })).state !== 'granted') {
      throw new Error(`Access to directory ${path} was denied.`)
    }
  }

  try {
    const stat = await Deno.stat(path)
    if (!stat.isDirectory) throw new Error(`${path} is not a directory`)
  } catch {
    throw new Error(`${path} does not exist`)
  }
  if (typeof path === 'string') {
    path = path.replace(/\/$/, '')
  } else {
    path = new URL(path.pathname.replace(/\/$/, ''), path)
  }

  const directoryListing = typeof options?.directoryListing === 'boolean'
    ? defaultDirectoryListing
    : typeof options?.directoryListing === 'function'
    ? options.directoryListing
    : undefined

  return async (ctx) => {
    if (ctx.request.method !== 'GET') return await ctx.next()
    let reqPath = ctx.request.url.pathname
    if (options?.baseURL !== undefined && !ctx.request.url.pathname.startsWith(options.baseURL)) {
      return await ctx.next()
    } else if (options?.baseURL !== undefined) {
      reqPath = reqPath.substring(options.baseURL.length)
    }

    let fsPath: string | URL
    if (typeof path === 'string') {
      fsPath = path + reqPath.replace(/\/$/, '')
    } else {
      fsPath = new URL(path.pathname + reqPath.replace(/\/$/, ''), path)
    }
    
    try {
      const stat = await Deno.stat(fsPath)
      if (stat.isDirectory) {
        if (directoryListing !== undefined) {
          return await directoryListing({
            isRoot: typeof fsPath === 'string'
              ? typeof path === 'string' ? fsPath === path : fsPath === path.pathname
              : typeof path === 'string' ? fsPath.pathname === path : fsPath.pathname === path.pathname,
            fileSystemPath: fsPath,
            request: ctx.request,
            response: ctx.response,
          })
        }
      } else if (stat.isFile) {
        const res = await serveFile(ctx.request.original, typeof fsPath === 'string' ? fsPath : fsPath.pathname, {
          fileInfo: stat,
        })
        ctx.response.from(res)
      }
    } catch {
      throw new Error(`${path} does not exist`)
    }
    await ctx.next()
  }
}

/**
 * Serves files from the specified path
 * Requires `allow-read` permission.
 * @param path
 *
 */
export async function serveDirectoryRoute(
  path: string | URL,
  options?: {
    directoryListing?: boolean | ((ctx: IncomingRequestDirectoryContext) => void | Promise<void>)
  }
): Promise<RouteHandler> {
  const fsBasePath = path instanceof URL ? path : new URL('file://' + path)

  if (fsBasePath.protocol !== 'file:') {
    throw new Error('The provided URL is not local')
  }

  if ((await Deno.permissions.query({ name: 'read', path: path })).state !== 'granted') {
    console.error('To be able to serve files from directory %s read access to that directory has to be granted.', path)
    if ((await Deno.permissions.request({ name: 'read', path: path })).state !== 'granted') {
      throw new Error(`Access to directory ${path} was denied.`)
    }
  }

  try {
    const stat = await Deno.stat(path)
    if (!stat.isDirectory) throw new Error(`${path} is not a directory`)
  } catch {
    throw new Error(`${path} does not exist`)
  }
  if (typeof path === 'string') {
    path = path.replace(/\/$/, '')
  } else {
    path = new URL(path.pathname.replace(/\/$/, ''), path)
  }

  const directoryListing = typeof options?.directoryListing === 'boolean'
    ? defaultDirectoryListing
    : typeof options?.directoryListing === 'function'
    ? options.directoryListing
    : undefined

  return async (ctx) => {
    if (ctx.request.method !== 'GET') {
      ctx.response.status = 404
      return
    }
    const reqPath = ctx.request.url.pathname

    let fsPath: string | URL
    if (typeof path === 'string') {
      fsPath = path + reqPath.replace(/\/$/, '')
    } else {
      fsPath = new URL(path.pathname + reqPath.replace(/\/$/, ''), path)
    }
    
    try {
      const stat = await Deno.stat(fsPath)
      if (stat.isDirectory) {
        if (directoryListing !== undefined) {
          return await directoryListing({
            isRoot: typeof fsPath === 'string'
              ? typeof path === 'string' ? fsPath === path : fsPath === path.pathname
              : typeof path === 'string' ? fsPath.pathname === path : fsPath.pathname === path.pathname,
            fileSystemPath: fsPath,
            request: ctx.request as RequestContext & Lollipop.RequestContext,
            response: ctx.response as ResponseContext & Lollipop.ResponseContext,
          })
        }
      } else if (stat.isFile) {
        const res = await serveFile(ctx.request.original, typeof fsPath === 'string' ? fsPath : fsPath.pathname, {
          fileInfo: stat,
        })
        ctx.response.from(res)
      }
    } catch {
      throw new Error(`${path} does not exist`)
    }
    ctx.response.status = 404
  }
}

async function defaultDirectoryListing(ctx: IncomingRequestDirectoryContext) {
  const entries: {entry: Deno.DirEntry, stat: Deno.FileInfo}[] = []
  for await (const entry of Deno.readDir(ctx.fileSystemPath)) {
    let fsPath: string | URL
    if (typeof ctx.fileSystemPath === 'string') {
      fsPath = Path.join(ctx.fileSystemPath, entry.name)
    } else {
      fsPath = new URL(Path.join(ctx.fileSystemPath.pathname, entry.name), ctx.fileSystemPath)
    }

    const stat = await Deno.stat(fsPath)
    if (entry.isFile && entry.name === 'index.html') {
      return ctx.response.from(await serveFile(ctx.request.original, typeof fsPath === 'string' ? fsPath : fsPath.pathname, {
        fileInfo: stat,
      }))
    }
    entries.push({entry,stat})
  }
}

export function errorBadRequest(message?: string, cause?: Error): HTTPError {
  return new HTTPError(message ?? 'Bad Request', 400, cause)
}

export function errorUnauthorized(message?: string, cause?: Error): HTTPError {
  return new HTTPError(message ?? 'Unauthorized', 401, cause)
}

export function websocket(handler: (websocket: WebSocket) => void | Promise<void>): ApplicationMiddlewareFunction {
  return async (ctx: IncomingRequestContext) => {
    if (ctx.request.method !== 'GET') return await ctx.next()
    if (!(ctx.request.headers.get('connection')?.split(/, ?/g) ?? []).map(it => it.toLowerCase()).includes('upgrade')) {
      throw errorBadRequest('This is a websocket endpoint and requires the connection to be upgraded: Missing header [Connection: Upgrade]')
    }
    if (ctx.request.headers.get('upgrade') !== 'websocket') {
      throw errorBadRequest('This is a websocket endpoint and requires the connection to be upgraded: Missing header [Upgrade: websocket]')
    }
    const upgrade = Deno.upgradeWebSocket(ctx.request.original)
    ctx.response.from(upgrade.response)
    Promise.resolve().then(() => handler(upgrade.socket))
  }
}

export function websocketRoute<P extends string>(handler: (websocket: WebSocket) => void | Promise<void>): RouteHandler<P> {
  return ctx => {
    if (ctx.request.method !== 'GET') throw new Error('Programmer error: websocket needs to be on method GET')
    if (!(ctx.request.headers.get('connection')?.split(/, ?/g) ?? []).map(it => it.toLowerCase()).includes('upgrade')) {
      throw errorBadRequest('This is a websocket endpoint and requires the connection to be upgraded: Missing header [Connection: Upgrade]')
    }
    if (ctx.request.headers.get('upgrade') !== 'websocket') {
      throw errorBadRequest('This is a websocket endpoint and requires the connection to be upgraded: Missing header [Upgrade: websocket]')
    }
    const upgrade = Deno.upgradeWebSocket(ctx.request.original)
    ctx.response.from(upgrade.response)
    Promise.resolve().then(() => handler(upgrade.socket))
  }
}
