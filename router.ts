import type { IApplicationMiddleware, RequestContext, ResponseContext } from './app.ts'

/**
 * Takes a path spec and an optional base path and resolves all parameter names
 */
type ResolveParams<
	P extends string,
	BasePath extends string | undefined = undefined
> = P extends `${string} ${infer Path}`
	? ResolveParams<Path, BasePath>
	: P extends `/:${infer Param}/${infer Rest}`
	? ResolveParams<Rest, BasePath> extends Record<string, string>
		? Record<Param | keyof ResolveParams<Rest, BasePath>, string>
		: Record<Param, string>
	: P extends `/:${infer Param}`
	? BasePath extends string
		? ResolveParams<BasePath> extends Record<string, string>
			? Record<Param | keyof ResolveParams<BasePath>, string>
			: Record<Param, string>
		: Record<Param, string>
	: P extends `:${infer Param}`
	? BasePath extends string
		? ResolveParams<BasePath> extends Record<string, string>
			? Record<Param | keyof ResolveParams<BasePath>, string>
			: Record<Param, string>
		: Record<Param, string>
	: P extends `/${infer PS}/${infer Rest}`
	? ResolveParams<Rest, BasePath>
	: P extends `/${infer PS}`
	? BasePath extends string
		? ResolveParams<BasePath>
		: Record<string, unknown>
	: BasePath extends string
	? ResolveParams<BasePath>
	: Record<string, unknown>

export interface IncomingRequestRouteContext<Path extends string, BasePath extends string = string> {
	readonly request: RequestContext
	readonly response: ResponseContext
	readonly params: Readonly<ResolveParams<Path, BasePath>>
}

type Awaitable<T> = T | Promise<T>
export type RouteHandler<Path extends string = string, BasePath extends string = string> = (
	ctx: IncomingRequestRouteContext<Path, BasePath>
) => Awaitable<void>

type RoutesDefinition<BasePath extends string, Def extends RoutesDefinition<BasePath, Def>> = {
	[K in keyof Def]: K extends string ? RouteHandler<K, BasePath> : never
}

export interface Router<BasePath extends string = ''> extends IApplicationMiddleware {
	route<Path extends string>(method: string, path: Path, handler: RouteHandler<Path, BasePath>): Router<BasePath>
	route<Path extends string>(methodAndPath: Path, handler: RouteHandler<Path, BasePath>): Router<BasePath>
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
	const routes: { method: string; url: URLPattern; handler: RouteHandler }[] = []
	const self: Router<BasePath> = {
		route<Path extends string>(
			...args:
				| [method: string, path: Path, handler: RouteHandler<Path, BasePath>]
				| [methodAndPath: Path, handler: RouteHandler<Path, BasePath>]
		): Router<BasePath> {
			const [_method, _path, _handler] = args
			const [method, path, handler]: [string, string, RouteHandler<Path, BasePath>] =
				typeof _method === 'string' && typeof _path === 'function'
					? [...resolveMethodAndPath(_method), _path]
					: typeof _method === 'string' && typeof _path === 'string' && typeof _handler === 'function'
					? [_method, _path, _handler]
					: ((() => {
							throw new Error('Illegal arguments')
					  })() as never)
			routes.push({
				method,
				url: new URLPattern(
					options?.baseURL !== undefined ? combinePaths(options.baseURL, path) : path,
					'http://localhost'
				),
				handler: handler as unknown as RouteHandler,
			})
			return self
		},
		routes<RoutesDef extends RoutesDefinition<BasePath, RoutesDef>>(routesDef: RoutesDef): Router<BasePath> {
			for (const [methodAndOrPath, handler] of Object.entries<RouteHandler<string, BasePath>>(routesDef)) {
				self.route(methodAndOrPath, handler)
			}
			return self
		},
		async doHandleRequest(ctx) {
			for (const route of routes) {
				if (!(route.method === 'ANY' || route.method === ctx.request.method)) continue
				const match = route.url.exec(ctx.request.url.pathname, 'http://localhost')
				if (match === null) continue
				route.handler({
					params: match.pathname.groups,
					request: ctx.request,
					response: ctx.response,
				})
				return
			}
			await ctx.next()
		},
	}

	return self

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
}
