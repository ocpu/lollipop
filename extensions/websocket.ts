import HTTPError from '../HTTPError.ts'
import { IncomingRequestContext } from '../app.ts'
import { IncomingRequestRouteContext } from '../router.ts'

export function errorBadRequest(message?: string, cause?: Error): HTTPError {
	return new HTTPError(message ?? 'Bad Request', 400, cause)
}

export function errorUnauthorized(message?: string, cause?: Error): HTTPError {
	return new HTTPError(message ?? 'Unauthorized', 401, cause)
}

function isRouteContext(ctx: IncomingRequestContext | IncomingRequestRouteContext<string>): ctx is IncomingRequestRouteContext<string> {
	return !('next' in ctx)
}

export function websocket(handler: (websocket: WebSocket) => void | Promise<void>) {
	return async (ctx: IncomingRequestContext | IncomingRequestRouteContext<string>) => {
		if (ctx.request.method !== 'GET') {
			if (isRouteContext(ctx)) {
				throw new Error('Programmer error: websocket needs to be only on method GET')
			} else {
				return await ctx.next()
			}
		}
		if (!(ctx.request.headers.get('connection')?.split(/, ?/g) ?? []).map(it => it.toLowerCase()).includes('upgrade')) {
			if (isRouteContext(ctx)) {
				throw errorBadRequest(
					'This is a websocket endpoint and requires the connection to be upgraded: Missing header [Connection: Upgrade]'
				)
			} else {
				return await ctx.next()
			}
		}
		if (ctx.request.headers.get('upgrade') !== 'websocket') {
			if (isRouteContext(ctx)) {
				throw errorBadRequest(
					'This is a websocket endpoint and requires the connection to be upgraded: Missing header [Upgrade: websocket]'
				)
			} else {
				return await ctx.next()
			}
		}
		const upgrade = Deno.upgradeWebSocket(ctx.request.original)
		ctx.response.from(upgrade.response)
		Promise.resolve().then(() => handler(upgrade.socket))
	}
}
