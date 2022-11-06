import type { IApplicationMiddleware, IncomingRequestContext } from './app.ts'

/**
 * Takes a path spec and an optional base path and resolves all parameter names
 */
type ResolveParams<
	Path extends string,
	BasePath extends string | undefined = undefined
> = Record<
	ResolvePathParams<GetPathParts<Path, BasePath>>[number],
	string
>
type GetPathParts<
	Path extends string,
	BasePath extends string | undefined = undefined
> = Path extends `${string} ${infer Rest}`
	? GetPathParts<Rest, BasePath>
	: BasePath extends string
	? GetPathParts<`${BasePath}/${Path}`>
	: Path extends `${infer Part}/${infer Rest}`
	? Part extends ``
		? GetPathParts<Rest>
		: [Part, ...GetPathParts<Rest>]
	: Path extends ``
	? []
	: [Path]
type ResolvePathParams<
	Parts extends string[],
	Star extends number = 0
> = Parts extends [infer Item, ...infer Rest extends string[]]
	? Item extends `:${infer Param}*`
		? [Param, ...ResolvePathParams<Rest, Star>]
		: Item extends `:${infer Param}`
			? [Param, ...ResolvePathParams<Rest, Star>]
			: Item extends `*`
				? [Star, ...ResolvePathParams<Rest, NextStar<Star>>]
				: ResolvePathParams<Rest, Star>
	: []
type NextStar<Star extends number> =
	| Star extends 0 ? 1 :
	Star extends 1 ? 2 :
	Star extends 2 ? 3 :
	Star extends 3 ? 4 :
	Star extends 4 ? 5 :
	Star extends 5 ? 6 :
	Star extends 6 ? 7 :
	Star extends 7 ? 8 :
	never

export interface IncomingRequestRouteContext<Path extends string, BasePath extends string = string> {
	readonly request: IncomingRequestContext['request']
	readonly response: IncomingRequestContext['response']
	readonly params: Readonly<ResolveParams<Path, BasePath>>
}

export interface IncomingRequestRouteMiddlewareContext<Path extends string, BasePath extends string = string> {
	readonly request: IncomingRequestContext['request']
	readonly response: IncomingRequestContext['response']
	readonly params: Readonly<ResolveParams<Path, BasePath>>
	next(): Promise<void>
	skip(...args: Parameters<IncomingRequestContext['next']>): ReturnType<IncomingRequestContext['next']>
}

type Awaitable<T> = T | Promise<T>
export type RouteHandler<Path extends string = string, BasePath extends string = string> = (
	ctx: IncomingRequestRouteContext<Path, BasePath>
) => Awaitable<void>
export type RouteMiddleware<Path extends string = string, BasePath extends string = string> = (
	ctx: IncomingRequestRouteMiddlewareContext<Path, BasePath>
) => Promise<void>

type RoutesDefinition<BasePath extends string, Def extends RoutesDefinition<BasePath, Def>> = {
	[K in keyof Def]: K extends string ? RouteHandler<K, BasePath> : never
}

export interface Router<BasePath extends string = ''> extends IApplicationMiddleware {
	route<Path extends string>(method: string, path: Path, handler: RouteHandler<Path, BasePath>): Router<BasePath>
	route<Path extends string>(method: string, path: Path, middleware: RouteMiddleware<Path, BasePath>[], handler: RouteHandler<Path, BasePath>): Router<BasePath>
	route<Path extends string>(methodAndPath: Path, handler: RouteHandler<Path, BasePath>): Router<BasePath>
	route<Path extends string>(methodAndPath: Path, middlewares: RouteMiddleware<Path, BasePath>[], handler: RouteHandler<Path, BasePath>): Router<BasePath>
	routes<RoutesDef extends RoutesDefinition<BasePath, RoutesDef>>(routesDef: RoutesDef): Router<BasePath>
}

export type MergePath<A extends string, B extends string> = A extends `${infer ABase}/`
	? B extends `/${infer BBase}`
		? `${ABase}/${BBase}`
		: `${ABase}/${B}`
	: B extends `/${infer BBase}`
		? `${A}/${BBase}`
		: `${A}/${B}`

export interface CreateRouterOptions<BasePath extends string> {
	baseURL?: BasePath | undefined
}

export function createRouter<BasePath extends string>(options?: CreateRouterOptions<BasePath>): Router<BasePath> {
	const handlers: ((ctx: IncomingRequestContext) => Promise<void>)[] = []
	const self: Router<BasePath> = {
		route<Path extends string>(
			...args:
				| [method: string, path: Path, handler: RouteHandler<Path, BasePath>]
				| [method: string, path: Path, middlewares: RouteMiddleware<Path, BasePath>[], handler: RouteHandler<Path, BasePath>]
				| [methodAndPath: Path, handler: RouteHandler<Path, BasePath>]
				| [methodAndPath: Path, middlewares: RouteMiddleware<Path, BasePath>[], handler: RouteHandler<Path, BasePath>]
		): Router<BasePath> {
			handlers.push(createMethodAndPathAndHandlerPair<Path, BasePath>(args)(options?.baseURL))
			return self
		},
		routes<RoutesDef extends RoutesDefinition<BasePath, RoutesDef>>(routesDef: RoutesDef): Router<BasePath> {
			for (const [methodAndOrPath, handler] of Object.entries<RouteHandler<string, BasePath>>(routesDef)) {
				self.route(methodAndOrPath, handler)
			}
			return self
		},
		async doHandleRequest(ctx) {
			const reqHandlers = handlers.slice()
			let head = 0

			const context = {
				request: ctx.request,
				response: ctx.response,
				async next() {
					const reqHandler = reqHandlers[head++]
					if (reqHandler === undefined) {
						return await ctx.next()
					}
					return await reqHandler(context)
				},
			}
			return await context.next()
		},
	}

	return self
}

function createMethodAndPathAndHandlerPair<Path extends string, BasePath extends string>(
	args:
		| [method: string, path: Path, handler: RouteHandler<Path, BasePath>]
		| [method: string, path: Path, middlewares: RouteMiddleware<Path, BasePath>[], handler: RouteHandler<Path, BasePath>]
		| [methodAndPath: Path, handler: RouteHandler<Path, BasePath>]
		| [methodAndPath: Path, middlewares: RouteMiddleware<Path, BasePath>[], handler: RouteHandler<Path, BasePath>]
): (baseURL: BasePath | undefined) => (ctx: IncomingRequestContext) => Promise<void> {
	if (args.length === 2) return createHandler(...resolveMethodAndPath(args[0]), args[1], [])
	if (args.length === 3 && Array.isArray(args[1])) return createHandler(...resolveMethodAndPath(args[0]), args[2], args[1])
	if (args.length === 3 && !Array.isArray(args[1])) return createHandler(args[0], args[1], args[2], [])
	if (args.length === 4) return createHandler(args[0], args[1], args[3], args[2])
	throw new Error('Illegal method signature')
}

function resolveMethodAndPath(methodAndOrPath: string) {
	const spaceIdx = methodAndOrPath.indexOf(' ')
	if (spaceIdx === -1) return ['ANY', methodAndOrPath] as const
	else {
		const method = methodAndOrPath.slice(0, spaceIdx).trim()
		const path = methodAndOrPath.slice(spaceIdx + 1).trim()
		return [method === '*' ? 'ANY' : method.toUpperCase(), path.trim()] as const
	}
}

function combinePaths<A extends string, B extends string>(a: A, b: B): MergePath<A, B> {
	if ((a.endsWith('/') && !b.startsWith('/')) || (!a.endsWith('/') && b.startsWith('/'))) {
		// 1 0 | 0 1
		return (a + b) as MergePath<A, B>
	} else if (a.endsWith('/') && b.startsWith('/')) {
		// 1 1
		return (a + b.substring(1)) as MergePath<A, B>
	} else {
		// 0 0
		return (a + '/' + b) as MergePath<A, B>
	}
}

function createHandler<Path extends string, BasePath extends string>(
	method: string,
	path: Path, 
	handler: RouteHandler<Path, BasePath>,
	middlewares: RouteMiddleware<Path, BasePath>[]
): (baseURL: BasePath | undefined) => (ctx: IncomingRequestContext) => Promise<void> {
	return baseURL => {
		const pathname = baseURL !== undefined ? path === '' ? baseURL : combinePaths(baseURL, path) : path
		const url = new URLPattern({ pathname })
		if (method === 'ANY') {
			return async ctx => {
				const match = url.exec(ctx.request.url)
				if (match === null) return await ctx.next()
				if (middlewares.length !== 0) return await doHandle(ctx, match)
				else return await handler(createHandlerContext(ctx, match))
			}
		} else {
			return async ctx => {
				if (method !== ctx.request.method) return await ctx.next()
				const match = url.exec(ctx.request.url)
				if (match === null) return await ctx.next()
				if (middlewares.length !== 0) return await doHandle(ctx, match)
				else return await handler(createHandlerContext(ctx, match))
			}
		}

		function createHandlerContext(ctx: IncomingRequestContext, match: URLPatternResult): IncomingRequestRouteContext<Path, BasePath> {
			return {
				params: match.pathname.groups,
				request: ctx.request,
				response: ctx.response,
			}
		}

		async function doHandle(ctx: IncomingRequestContext, match: URLPatternResult) {
			const reqMiddlewares = middlewares.slice()
			let head = 0

			const context: IncomingRequestRouteMiddlewareContext<Path, BasePath> = {
				params: match.pathname.groups,
				request: ctx.request,
				response: ctx.response,
				skip: ctx.next,
				async next() {
					const reqMiddleware = reqMiddlewares[head++]
					if (reqMiddleware === undefined) {
						return await handler(createHandlerContext(ctx, match))
					}
					return await reqMiddleware(context)
				},
			}

			return await context.next()
		}
	}
}
