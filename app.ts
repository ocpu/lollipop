import type { ServeInit } from 'https://deno.land/std@0.152.0/http/server.ts'
import { deferred, Deferred } from 'https://deno.land/std@0.152.0/async/mod.ts'
import { accepts } from 'https://deno.land/std@0.152.0/http/negotiation.ts'

declare global {
	namespace Lollipop {
		// The interfaces here are for extensions so that they can extend the handler context
		// when handling them in a route handler.

		// deno-lint-ignore no-empty-interface
		interface RequestContext {}

		// deno-lint-ignore no-empty-interface
		interface ResponseContext {}
	}
}

let startListen = true
let applications: Application[] | undefined
let applicationToServingAddressMap: Map<Required<Deno.ListenOptions>, Application> | undefined

export interface TestSetup {
	resolveRequest(request: Request): Promise<Response>
	resolveRequest(selector: Application | Deno.ListenOptions | string, request: Request): Promise<Response>
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
}

export async function setupApplictionsForTest(startApplication?: () => Promise<unknown>): Promise<TestSetup> {
	const apps: Application[] = []
	const appToServingAddressMap = new Map<Required<Deno.ListenOptions>, Application>()

	applications = apps
	applicationToServingAddressMap = appToServingAddressMap
	startListen = false
	await startApplication?.()
	startListen = true
	applicationToServingAddressMap = undefined
	applications = undefined

  let setup: TestSetup
	return setup = {
		async resolveRequest(
			...args: [selector: Application | Deno.ListenOptions | string, request: Request] | [request: Request]
		) {
			if (args[0] instanceof Request) {
				const request = args[0]
				const url = new URL(request.url)
				const selector: Deno.ListenOptions = {
					port: Number(url.port),
					hostname: url.hostname,
				}

				for (const [listenOptions, app] of appToServingAddressMap) {
					if (listenOptions.port !== selector.port) continue
					if (selector.hostname !== undefined && !hostnamesEquals(selector.hostname, listenOptions.hostname)) continue
					return await app.handle(request)
				}

				throw new Error(`Could not find app listening on ${selector.hostname ?? ''}:${selector.port}`)
			} else if (typeof (args[0] as Application).handle === 'function') {
				const app = args[0] as Application
				return await app.handle(args[1]!)
			} else {
				const selector = typeof args[0] === 'string' ? parseAddrFromStr(args[0]) : (args[0] as Deno.ListenOptions)
				const request = args[1]!
				for (const [listenOptions, app] of appToServingAddressMap) {
					if (listenOptions.port !== selector.port) continue
					if (selector.hostname !== undefined && !hostnamesEquals(selector.hostname, listenOptions.hostname)) continue
					return await app.handle(request)
				}
				throw new Error(`Could not find app listening on ${selector.hostname ?? ''}:${selector.port}`)
			}
		},
    fetch(input, init) {
      return setup.resolveRequest(new Request(input, init))
    }
	}
}

export interface ServerEventSource extends Deno.Closer {
	send(event: string, data?: string, id?: string): void
	sendJSON(event: string, data: unknown, id?: string): void
	/** Some browsers will close an event source if no message has been sent in a while. */
	startKeepAlive(options?: { event?: string; timeout?: number; signal?: AbortSignal }): void
}

export interface ResponseContext {
	status: number
	headers: Headers
	body: ReadableStream<Uint8Array> | null
	from(response: Response): void
	html(html: string | { toString(): string }): void
	json(
		data: unknown,
		replacer?: ((this: Record<string | number | symbol, unknown>, key: string, value: unknown) => unknown) | undefined
	): void
	arrayBuffer(data: ArrayBuffer): void
	blob(data: Blob): void
	formData(data: FormData): void
	text(data: string): void
	eventSource(): ServerEventSource
	/** Use a temporary redirect (307) to direct the client to a different location. */
	redirect(location: string): void
	/** Use a permanent redirect (308) to direct the client to a different location. */
	redirectPermanent(location: string): void
	/** Use a permanent redirect (301) to direct the client to a different location. Some very old browsers may not support the 308 status code. */
	redirectPermanentCompat(location: string): void
}

type MimeTypeString = `${string}/${string}` | `${string}/*` | `*/*` | keyof typeof mimeTypeShorthands

export interface RequestContext {
	readonly original: Request
	readonly url: URL
	readonly method: string
	readonly headers: Headers
	body: ReadableStream<Uint8Array> | null
	bodyUsed: boolean
	arrayBuffer(): Promise<ArrayBuffer>
	blob(): Promise<Blob>
	formData(): Promise<FormData>
	text(): Promise<string>
	json<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T>
	/** Test if the accept header has any of the defined types and return the one that is most prefered. `false` if none match. */
	accepts<Types extends readonly MimeTypeString[]>(...type: Types): Types[number] | false
	/**
	 * Simplify the switch case into an object where the key is the content type to test and the value is the handler
	 * for that content type. `else` must be defined for any other content type that does not appear as a key.
	 */
	accepting(
		typesObject: { [K: string]: () => void | Promise<void> } & { else: () => void | Promise<void> }
	): void | Promise<void>
}

export interface IncomingRequestContext {
	readonly request: RequestContext & Lollipop.RequestContext
	readonly response: ResponseContext & Lollipop.ResponseContext
	next(): Promise<void>
}

export type ApplicationMiddlewareFunction = (ctx: IncomingRequestContext) => Promise<void>
export interface IApplicationMiddleware {
	doHandleRequest(ctx: IncomingRequestContext): Promise<void>
}
export type ApplicationMiddleware = ApplicationMiddlewareFunction | IApplicationMiddleware
export interface Application {
	use(middleware: ApplicationMiddleware): Application
	handle(request: Request): Promise<Response>
	serve(options?: ServeInit): Promise<void>
	serve(address: string, options?: Omit<ServeInit, keyof Deno.ListenOptions>): Promise<void>
}

const mimeTypeShorthands = {
	json: 'application/json',
	html: 'text/html',
	css: 'text/css',
	js: 'text/javascript',
	javascript: 'text/javascript',
	svg: 'image/svg+xml',
	png: 'image/png',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
}

export function createApp(): Application
export function createApp(middlewares?: ApplicationMiddleware[]): Application
export function createApp(_middlewares?: ApplicationMiddleware[]): Application {
	const middlewares: ApplicationMiddleware[] = _middlewares ?? []
	const app: Application = {
		use(middleware) {
			middlewares.push(middleware)
			return app
		},
		async serve(
			...args: [options?: ServeInit] | [address: string, options?: Omit<ServeInit, keyof Deno.ListenOptions>]
		) {
			const opts = (typeof args[0] === 'string' ? { ...parseAddrFromStr(args[0]), ...args[1] } : args[0]) ?? {}
			opts.hostname ??= '0.0.0.0'
			opts.port ??= 8000
			applicationToServingAddressMap?.set(opts as Required<Deno.ListenOptions>, app)
			if (startListen) {
				const { serve } = await import('https://deno.land/std@0.152.0/http/server.ts')
				await serve(app.handle, opts)
				applicationToServingAddressMap?.delete(opts as Required<Deno.ListenOptions>)
			}
		},
		async handle(req) {
			const reqMiddlewares = middlewares.slice()
			let head = 0

			const request: RequestContext = {
				original: req,
				url: new URL(req.url),
				method: req.method,
				headers: req.headers,
				body: req.body,
				get bodyUsed() {
					return req.bodyUsed
				},
				arrayBuffer(): Promise<ArrayBuffer> {
					return req.arrayBuffer()
				},
				blob(): Promise<Blob> {
					return req.blob()
				},
				formData(): Promise<FormData> {
					return req.formData()
				},
				text(): Promise<string> {
					return req.text()
				},
				json<T extends unknown = unknown>(): Promise<T> {
					return req.json()
				},
				accepts<Types extends readonly MimeTypeString[]>(...types: Types): Types[number] | false {
					return (accepts(request.original, ...types) ?? false) as Types[number] | false
				},
				accepting(obj) {
					const keys = Object.keys(obj)
					if (!keys.includes('else'))
						throw new Error('Must include a handling for anything else that does not match your defined mime types')
					keys.splice(keys.indexOf('else'), 1)
					if (keys.length > 0) {
						const res = request.accepts(...(keys as unknown as readonly MimeTypeString[]))
						if (res !== false) return obj[res]()
					}
					return obj.else()
				},
			}

			const response: ResponseContext = {
				body: null,
				status: 200,
				headers: new Headers(),
				from(res) {
					response.status = res.status
					response.headers = res.headers
					response.body = res.body
				},
				html(html) {
					response.headers.set('Content-Type', 'text/html')
					response.body = new Response(String(html)).body
				},
				json(data, replacer) {
					const text = JSON.stringify(data, replacer)
					if (!response.headers.has('Content-Type')) {
						response.headers.set('Content-Type', 'application/json')
					}
					response.body = new Response(String(text)).body
				},
				arrayBuffer(data) {
					if (!response.headers.has('Content-Type')) {
						response.headers.set('Content-Type', 'application/octet-stream')
					}
					response.body = new Response(data).body
				},
				blob(data) {
					if (!response.headers.has('Content-Type')) {
						response.headers.set('Content-Type', 'application/octet-stream')
					}
					response.body = new Response(data).body
				},
				formData(data) {
					if (!response.headers.has('Content-Type')) {
						let mimeType = 'application/x-www-form-urlencoded'
						for (const [, entry] of data.entries()) {
							if (typeof entry !== 'string') {
								mimeType = 'multipart/form-data'
							}
						}
						response.headers.set('Content-Type', mimeType)
					}
					response.body = new Response(data).body
				},
				text(data) {
					if (!response.headers.has('Content-Type')) {
						response.headers.set('Content-Type', 'text/plain')
					}
					response.body = new Response(data).body
				},
				eventSource() {
					response.headers.set('Content-Type', 'text/event-stream')
					response.headers.set('Transfer-Encoding', 'chunked')
					const textEncoder = new TextEncoder()
					type Message = { type: 'message'; event?: string; data?: string; id?: string } | { type: 'close' }
					let messageQueue: Message[] | undefined = []
					let defering: Deferred<void> | undefined
					let keepAliveInterval: number | undefined

					const body = new ReadableStream<Uint8Array>({
						async pull(controller) {
							try {
								while (true) {
									defering = undefined
									let message: Message | undefined
									while (messageQueue !== undefined && (message = messageQueue.pop()) !== undefined) {
										if (message.type === 'close') {
											controller.enqueue(textEncoder.encode('MA==\r\n\r\n'))
											messageQueue = undefined
											controller.close()
											return
										}
										let messageData = ''
										if (message.id !== undefined) messageData += `id: ${message.id}\n`
										if (message.event !== undefined) messageData += `event: ${message.event}\n`
										if (message.data !== undefined || messageData !== '')
											messageData += `data:${message.data === undefined ? '' : ' ' + message.data}\n`
										if (messageData !== '') messageData += '\n'
										controller.enqueue(
											textEncoder.encode(messageData.length.toString(16) + '\r\n' + messageData + '\r\n')
										)
									}
									defering = deferred()
									await defering
								}
							} catch (e) {
								controller.error(e)
							}
						},
					})

					ctx.response.body = body
					let es: ServerEventSource
					return (es = {
						send(event, data, id) {
							if (messageQueue === undefined) throw new Error('Event source is closed')
							messageQueue.push({ type: 'message', event, data, id })
							if (defering !== undefined) {
								defering.resolve()
							}
						},
						sendJSON(event, data, id) {
							es.send(event, JSON.stringify(data), id)
						},
						startKeepAlive({ event, timeout, signal } = {}) {
							if (keepAliveInterval !== undefined) clearInterval(keepAliveInterval)
							if (signal !== undefined && signal.aborted) return
							keepAliveInterval = setInterval(() => es.send(event ?? 'keepalive'), timeout ?? 2500)
						},
						close() {
							if (messageQueue === undefined) throw new Error('Event source is closed')
							messageQueue.push({ type: 'close' })
							if (keepAliveInterval !== undefined) clearInterval(keepAliveInterval)
							if (defering !== undefined) {
								defering.resolve()
							}
						},
					})
				},
				redirect(location) {
					response.status = request.method === 'PUT' || request.method === 'POST' ? 303 : 307
					response.headers.set('Location', location)
				},
				redirectPermanent(location) {
					response.status = request.method === 'PUT' || request.method === 'POST' ? 303 : 308
					response.headers.set('Location', location)
				},
				redirectPermanentCompat(location) {
					response.status = request.method === 'PUT' || request.method === 'POST' ? 303 : 301
					response.headers.set('Location', location)
				},
			}

			const ctx: IncomingRequestContext = {
				request: request as RequestContext & Lollipop.RequestContext,
				response: response as ResponseContext & Lollipop.ResponseContext,
				async next() {
					const reqMiddleware = reqMiddlewares[head++]
					if (reqMiddleware === undefined) {
						response.status = 404
						return
					}
					if (typeof reqMiddleware === 'function') {
						await reqMiddleware(ctx)
					} else {
						await reqMiddleware.doHandleRequest(ctx)
					}
				},
			}
			await ctx.next()
			return new Response(response.body, {
				status: response.status,
				headers: response.headers,
			})
		},
	}
	applications?.push(app)
	return app
}

export function parseAddrFromStr(addr: string): Deno.ListenOptions {
	try {
		const host = !addr.startsWith('::') && addr.startsWith(':') ? `0.0.0.0${addr}` : addr
		const url = new URL(`http://${host}`)
		return {
			hostname: url.hostname,
			port: url.port === '' ? 80 : Number(url.port),
		}
	} catch {
		throw new TypeError('Invalid address.')
	}
}

const localhostAddresses = ['127.0.0.1', '0.0.0.0', 'localhost']

function hostnamesEquals(a: string, b: string) {
	return (localhostAddresses.includes(a) && localhostAddresses.includes(b)) || a === b
}
