import { ApplicationMiddleware, IncomingRequestContext } from '../app.ts'

interface CORSConfig {
	addMapping(pathnamePattern: string): CORSConfigMapping
	addMapping(pathnamePattern: string, config?: Omit<CORSMatcher, 'pattern' | 'status'> | undefined): CORSConfigMapping
}
interface CORSConfigMapping {
	readonly and: CORSConfig

	/**
	 * Configure the numeric status that should be responeded with when a OPTIONS
	 * request comes in.
	 * 
	 * The default is 204.
	 * @param status The status that should be returned
	 */
	status(status: number): CORSConfigMapping

	/**
	 * Configure the allowed origins.
	 * 
	 * This can in most cases be set to `'*'` to allow all. `'*'` is not
	 * compatible most of the time with allow credentials for most User Agents.
	 * 
	 * @param origins The origins that are allowed
	 */
	allowedOrigin(...origins: string[]): CORSConfigMapping

	/**
	 * Configure the allowed origins.
	 * 
	 * This can in most cases be set to `'*'` to allow all. `'*'` is not
	 * compatible most of the time with allow credentials for most User Agents.
	 * 
	 * @param getOrigins The origins that are allowed
	 */
	allowedOrigin(getOrigins: (ctx: Omit<IncomingRequestContext, 'next'>) => string[] | Promise<string[]>): CORSConfigMapping

	/**
	 * Configure the allowed verbs / methods.
	 * 
	 * The usual set of methods allowed are: `GET`, `HEAD`, `PUT`, `PATCH`, `POST`,
	 * `DELETE`.
	 * 
	 * @param methods The methods that are allowed
	 */
	allowedMethods(...methods: string[]): CORSConfigMapping

	/**
	 * Configure the allowed verbs / methods.
	 * 
	 * The usual set of methods allowed are: `GET`, `HEAD`, `PUT`, `PATCH`, `POST`,
	 * `DELETE`.
	 * 
	 * @param getMethods The methods that are allowed
	 */
	allowedMethods(getMethods: (ctx: Omit<IncomingRequestContext, 'next'>) => string[] | Promise<string[]>): CORSConfigMapping

	/**
	 * Configure the allowed headers.
	 * 
	 * @param headers The headers that are allowed
	 */
	allowedHeaders(...headers: string[]): CORSConfigMapping

	/**
	 * Configure the allowed headers.
	 * 
	 * @param getHeaders The headers that are allowed
	 */
	allowedHeaders(getHeaders: (ctx: Omit<IncomingRequestContext, 'next'>) => string[] | Promise<string[]>): CORSConfigMapping

	/**
	 * Configure that credentials are allowed in CORS requests.
	 * 
	 * Credentials usally are the cookies stored on the User Agent for your
	 * website. [Read more on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials)
	 */
	allowCredentials(): CORSConfigMapping

	/**
	 * Configure that credentials are allowed in CORS requests.
	 * 
	 * Credentials usally are the cookies stored on the User Agent for your
	 * website. [Read more on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials)
	 * 
	 * @param allowed Whether or not credentials are allowed.
	 */
	allowCredentials(allowed: boolean): CORSConfigMapping

	/**
	 * Configure that credentials are allowed in CORS requests.
	 * 
	 * Credentials usally are the cookies stored on the User Agent for your
	 * website. [Read more on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials)
	 * 
	 * @param getAllowed Whether or not credentials are allowed.
	 */
	allowCredentials(getAllowed: (ctx: Omit<IncomingRequestContext, 'next'>) => boolean | Promise<boolean>): CORSConfigMapping

	/**
	 * Configure the amount of seconds the result of a CORS request can be cached.
	 * 
	 * @param deltaSeconds The amount of seconds that the result can be cached
	 */
	maxAge(deltaSeconds: number): CORSConfigMapping

	/**
	 * Configure the amount of seconds the result of a CORS request can be cached.
	 * 
	 * @param getDeltaSeconds The amount of seconds that the result can be cached
	 */
	maxAge(getDeltaSeconds: (ctx: Omit<IncomingRequestContext, 'next'>) => number | Promise<number>): CORSConfigMapping

	/**
	 * Configure a function that will be run at the end of the CORS checking that
	 * can freely mutate the resulting result.
	 * 
	 * @param mutator A function that can mutate the resulting message.
	 */
	mutate(mutator: (ctx: Omit<IncomingRequestContext, 'next'>) => void | Promise<void>): CORSConfigMapping
}
function defaultCORSConfigurer(config: CORSConfig) {
	config
		.addMapping('*')
		.allowedOrigin('*')
		.allowedMethods('GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE')
}
interface CORSMatcher {
	pattern: URLPattern
	status: number
	origin?(ctx: Omit<IncomingRequestContext, 'next'>): string[] | Promise<string[]>
	methods?(ctx: Omit<IncomingRequestContext, 'next'>): string[] | Promise<string[]>
	headers?(ctx: Omit<IncomingRequestContext, 'next'>): string[] | Promise<string[]>
	credentials?(ctx: Omit<IncomingRequestContext, 'next'>): boolean | Promise<boolean>
	maxAge?(ctx: Omit<IncomingRequestContext, 'next'>): number | Promise<number>
	mutate?(ctx: Omit<IncomingRequestContext, 'next'>): void | Promise<void>
}
export async function cors(configure?: (config: CORSConfig) => unknown | Promise<unknown>): Promise<ApplicationMiddleware> {
	const matchers: CORSMatcher[] = []
	{
		const config: CORSConfig = {
			addMapping(...args: [string, Omit<CORSMatcher, 'pattern'> | undefined] | [string]) {
				const [pattern, init] = args
				const mutators: Set<(ctx: Omit<IncomingRequestContext, 'next'>) => void | Promise<void>> = new Set()
				const mutate: (ctx: Omit<IncomingRequestContext, 'next'>) => void|Promise<void> = async ctx => {
					for (const mutator of mutators) {
						const res = mutator(ctx)
						if (res !== undefined && res !== null && typeof res.then === 'function') await res
					}
				}
				const matcher: CORSMatcher = {
					status: 204,
					pattern: new URLPattern({ pathname: pattern }),
				}
				matchers.push(matcher)
				const mapping: CORSConfigMapping = {
					and: config,
					status(status) {
						matcher.status = status
						return mapping
					},
					allowedOrigin(...args: string[] | [(ctx: IncomingRequestContext) => string[] | Promise<string[]>]) {
						if (args.length === 0) return mapping
						const args0 = args[0]
						if (typeof args0 === 'function') {
							matcher.origin = args0
						} else {
							matcher.origin = () => args as string[]
						}
						return mapping
					},
					allowedHeaders(...args: string[] | [(ctx: IncomingRequestContext) => string[] | Promise<string[]>]) {
						if (args.length === 0) return mapping
						const args0 = args[0]
						if (typeof args0 === 'function') {
							matcher.headers = args0
						} else {
							matcher.headers = () => args as string[]
						}
						return mapping
					},
					allowedMethods(...args: string[] | [(ctx: IncomingRequestContext) => string[] | Promise<string[]>]) {
						if (args.length === 0) return mapping
						const args0 = args[0]
						if (typeof args0 === 'function') {
							matcher.methods = args0
						} else {
							matcher.methods = () => args as string[]
						}
						return mapping
					},
					allowCredentials(...args: [] | [boolean] | [(ctx: IncomingRequestContext) => boolean | Promise<boolean>]) {
						const [allowed] = args
						if (allowed === undefined) {
							matcher.credentials = () => true
						} else if (typeof allowed === 'boolean') {
							matcher.credentials = () => allowed
						} else {
							matcher.credentials = allowed
						}
						return mapping
					},
					maxAge(...args: [number] | [(ctx: IncomingRequestContext) => number | Promise<number>]) {
						const [deltaSeconds] = args
						if (typeof deltaSeconds === 'number') {
							matcher.maxAge = () => deltaSeconds
						} else {
							matcher.maxAge = deltaSeconds
						}
						return mapping
					},
					mutate(mutator) {
						if (matcher.mutate === undefined) matcher.mutate = mutate
						mutators.add(mutator)
						return mapping
					}
				}
				if (init !== undefined) {
					if ('status' in init) mapping.status(init['status'])
					if ('allowedOrigin' in init) mapping.allowedOrigin(init['allowedOrigin'] as ((ctx: Omit<IncomingRequestContext, 'next'>) => string[] | Promise<string[]>))
					if ('allowedHeaders' in init) mapping.allowedHeaders(init['allowedHeaders'] as ((ctx: Omit<IncomingRequestContext, 'next'>) => string[] | Promise<string[]>))
					if ('allowedMethods' in init) mapping.allowedMethods(init['allowedMethods'] as ((ctx: Omit<IncomingRequestContext, 'next'>) => string[] | Promise<string[]>))
					if ('allowCredentials' in init) mapping.allowCredentials(init['allowCredentials'] as ((ctx: Omit<IncomingRequestContext, 'next'>) => boolean | Promise<boolean>))
					if ('maxAge' in init) mapping.maxAge(init['maxAge'] as ((ctx: Omit<IncomingRequestContext, 'next'>) => number | Promise<number>))
					if ('mutate' in init) mapping.mutate(init['mutate'] as ((ctx: Omit<IncomingRequestContext, 'next'>) => void | Promise<void>))
				}
				return mapping
			}
		}
		await (configure ?? defaultCORSConfigurer)(config)
	}
	return async ctx => {
		if (ctx.request.method === 'OPTIONS') {
			const matcher = matchers.find(matcher => matcher.pattern.test(ctx.request.url))
			ctx.response.status = matcher?.status ?? 204
			if (matcher === undefined) return
			if (matcher.origin !== undefined) {
				let res = matcher.origin(ctx)
				if (!Array.isArray(res)) res = await res
				const origin = ctx.request.headers.get('Origin')
				if (origin === null && res.includes('*')) {
					ctx.response.headers.set('Access-Control-Allow-Origin', '*')
				} else if (origin !== null && (res.includes('*') || res.includes(origin))) {
					ctx.response.headers.set('Access-Control-Allow-Origin', origin)
				} else return
			}
			if (matcher.methods !== undefined) {
				let res = matcher.methods(ctx)
				if (!Array.isArray(res)) res = await res
				if (res.length !== 0) {
					ctx.response.headers.set('Access-Control-Allow-Methods', res.join(', '))
				}
			}
			if (matcher.headers !== undefined) {
				let res = matcher.headers(ctx)
				if (!Array.isArray(res)) res = await res
				if (res.length !== 0) {
					ctx.response.headers.set('Access-Control-Allow-Headers', res.join(', '))
				}
			}
			if (matcher.credentials !== undefined) {
				let res = matcher.credentials(ctx)
				if (typeof res !== 'boolean') res = await res
				if (res) ctx.response.headers.set('Access-Control-Allow-Credentials', 'true')
			}
			if (matcher.maxAge !== undefined) {
				let res = matcher.maxAge(ctx)
				if (typeof res !== 'number') res = await res
				ctx.response.headers.set('Access-Control-Max-Age', String(res))
			}
			if (matcher.mutate !== undefined) {
				const res = matcher.mutate({
					request: ctx.request,
					response: ctx.response,
				})
				if (res !== undefined && res !== null && typeof res.then === 'function') await res
			}
		} else await ctx.next()
	}
}
