import { ApplicationMiddlewareFunction } from '../app.ts'
import { CookieAttributes } from './cookies.ts'

declare global {
	namespace Lollipop {
		interface RequestContext {
			readonly csrfToken: string | undefined
		}
		interface ResponseContext {
			readonly csrfToken: string
		}
	}
}

const defaultCookieOptions: CookieAttributes = {
	httpOnly: true,
	sameSite: 'strict',
	maxAge: 8 * 60 * 60 * 1000,
}
const defaultCookieName = 'csrf-token'
export default function configureCSRF({ cookie }: { cookie?: (CookieAttributes & { name?: string }) | string } = {}): ApplicationMiddlewareFunction {
	const cookieName = typeof cookie === 'string' ? cookie : cookie?.name ?? defaultCookieName
	const cookieOptions: CookieAttributes = {
		...defaultCookieOptions,
		...(typeof cookie === 'string' ? null : cookie),
	}
	return async ctx => {
		if (ctx.request.method === 'OPTIONS') return await ctx.next()
		if (ctx.request.method === 'GET') {
			let csrfToken: string | undefined
			Object.defineProperty(ctx.response, 'csrfToken', {
				get() {
					if (csrfToken === undefined) {
						csrfToken = crypto.randomUUID()
						ctx.response.setCookie(cookieName, csrfToken, cookieOptions)
					}
					return csrfToken
				},
			})
		} else {
			Object.defineProperty(ctx.request, 'csrfToken', {
				writable: false,
				value: ctx.request.cookies[cookieName]
			})
			ctx.response.setCookie(cookieName, '', { maxAge: 0 })
		}
		return await ctx.next()
	}
}
