import { ApplicationMiddlewareFunction } from '../app.ts'
import { CookieAttributes, setCookie } from './_cookie/utils.ts'

declare global {
	namespace Lollipop {
		interface RequestContext {
			/**
			 * This is a value of the client token picked up from either a cookie or
			 * headers.
			 */
			readonly csrfToken: string | undefined
		}
		interface ResponseContext {
			/**
			 * Get a token that can be used as an authenticator for a single request.
			 *
			 * Side effects are included on first invocation for a each request. The
			 * current side effects include setting a cookie if enabled with a
			 * configured name.
			 */
			readonly csrfToken: string
		}
	}
}

const defaultCookieOptions: CookieAttributes = {
	httpOnly: true,
	sameSite: 'strict',
	maxAge: 8 * 60 * 60 * 1000,
}

interface ConfigureCSRFOptions {
	/**
	 * Configure the cookie parameters and name that this extension produces and
	 * reads from requests. Set to false to disable this capability.
	 */
	cookie?: (CookieAttributes & { name?: string }) | string | false

	/**
	 * Configure what headers that are able to contain a CSRF token. Set to false
	 * to disable this capability.
	 */
	header?: string[] | string | false
}
const defaultCookieName = 'csrf-token'
const defaultHeaderNames = ['X-XSRF-Token', 'X-CSRF-Token']

export default function configureCSRF({ cookie, header }: ConfigureCSRFOptions = {}): ApplicationMiddlewareFunction {
	const cookieName =
		typeof cookie === 'string'
			? cookie
			: typeof cookie === 'boolean' && !cookie
			? undefined
			: cookie?.name ?? defaultCookieName
	const cookieOptions: CookieAttributes = {
		...defaultCookieOptions,
		...(typeof cookie === 'string' ? null : cookie),
	}
	const headerNames =
		typeof header === 'string'
			? [header]
			: typeof header === 'boolean' && !header
			? undefined
			: header === undefined
			? defaultHeaderNames
			: Array.isArray(header)
			? header
			: [header]
	return async ctx => {
		if (ctx.request.method === 'OPTIONS') return await ctx.next()
		if (ctx.request.method === 'GET') {
			let csrfToken: string | undefined
			Object.defineProperty(ctx.response, 'csrfToken', {
				get() {
					if (csrfToken === undefined) {
						csrfToken = crypto.randomUUID()
						if (cookieName !== undefined) {
							setCookie(ctx, cookieName, csrfToken, cookieOptions)
						}
					}
					return csrfToken
				},
			})
		} else {
			let value = cookieName !== undefined ? ctx.request.cookies[cookieName] : undefined
			if (value === undefined && headerNames !== undefined) {
				for (const headerName of headerNames) {
					if (ctx.request.headers.has(headerName)) {
						value = ctx.request.headers.get(headerName) ?? undefined
						break
					}
				}
			}
			Object.defineProperty(ctx.request, 'csrfToken', {
				writable: false,
				value,
			})
			if (cookieName !== undefined) {
				setCookie(ctx, cookieName, '', { maxAge: 0 })
			}
		}
		return await ctx.next()
	}
}
