import HTTPError from './HTTPError.ts'
import { createApp, ApplicationMiddleware, IncomingRequestContext, ApplicationMiddlewareFunction } from './app.ts'
import { createRouter, IncomingRequestRouteContext, RouteHandler } from './router.ts'
import { ServeDirectoryOptions } from './ext_static_shadow.ts'
import { CookieAttributes } from './ext_cookies_shadow.ts'
import { TemplatingOptions } from './ext_templating_shadow.ts'

export { createApp, setupApplictionsForTest } from './app.ts'
export { createRouter } from './router.ts'
export { default as React, default as h } from './basic-jsx.ts'
export type {
	ApplicationMiddleware,
	ApplicationMiddlewareFunction,
	Application,
	IApplicationMiddleware,
	IncomingRequestContext,
	RequestContext,
	ResponseContext,
	TestSetup,
} from './app.ts'
export type { CreateRouterOptions, IncomingRequestRouteContext, RouteHandler, Router } from './router.ts'

export type { ServeDirectoryOptions } from './ext_static_shadow.ts'
export type { CookieAttributes } from './ext_cookies_shadow.ts'
export type { TemplatingOptions } from './ext_templating_shadow.ts'

type RoutesDefinition<BasePath extends string, Def extends RoutesDefinition<BasePath, Def>> = {
	[K in keyof Def]: K extends string ? RouteHandler<K, BasePath> : never
}

export function serve<RoutesDef extends RoutesDefinition<string, RoutesDef>>(routesDef: RoutesDef): Promise<void>
export function serve<RoutesDef extends RoutesDefinition<string, RoutesDef>>(
	middlewares: ApplicationMiddleware[],
	routesDef: RoutesDef
): Promise<void>
export function serve<RoutesDef extends RoutesDefinition<string, RoutesDef>>(
	...args: [routesDef: RoutesDef] | [middlewares: ApplicationMiddleware[], routesDef: RoutesDef]
): Promise<void> {
	const routesDef = Array.isArray(args[0]) ? args[1] : args[0]
	const middlewares = Array.isArray(args[0]) ? args[0] : []
	return createApp(middlewares).use(createRouter().routes(routesDef)).serve()
}

export function errorBadRequest(message?: string, cause?: Error): HTTPError {
	return new HTTPError(message ?? 'Bad Request', 400, cause)
}

export function errorUnauthorized(message?: string, cause?: Error): HTTPError {
	return new HTTPError(message ?? 'Unauthorized', 401, cause)
}

export type AppOrRouterMiddlewareFunction = (ctx: IncomingRequestContext | IncomingRequestRouteContext<string>) => Promise<void>

/**
 * Serves files from the specified path.
 * 
 * This middleware can either be used as a application middleware or a router
 * function.
 * 
 * Requires `allow-read` permission.
 * @param path
 */
export async function serveDirectory(
	path: string | URL,
	options?: ServeDirectoryOptions & { baseURL?: string }
): Promise<AppOrRouterMiddlewareFunction> {
	return (await import('./extensions/static.ts')).serveDirectory(path, options)
}

/**
 * A middleware that accepts incoming websocket connections.
 * 
 * This middleware can either be used as a application middleware or a router
 * function.
 * @param handler 
 * @returns 
 */
export async function websocket(handler: (websocket: WebSocket) => void | Promise<void>): Promise<AppOrRouterMiddlewareFunction> {
	return (await import('./extensions/websocket.ts')).websocket(handler)
}

export async function configureCookies(): Promise<ApplicationMiddleware> {
	return (await import('./extensions/cookies.ts')).default()
}

export async function configureTemplating(options: TemplatingOptions): Promise<ApplicationMiddlewareFunction> {
	return (await import('./extensions/templating.ts')).default(options)
}
