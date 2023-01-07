import HTTPError from './HTTPError.ts'
import { createApp, ApplicationMiddleware, IncomingRequestContext } from './app.ts'
import { createRouter, IncomingRequestRouteContext, RouteHandler } from './router.ts'

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
export type {
	CreateRouterOptions,
	IncomingRequestRouteContext,
	RouteHandler,
	IncomingRequestRouteMiddlewareContext,
	RouteMiddleware,
	Router,
} from './router.ts'

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
