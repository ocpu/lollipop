import { ApplicationMiddlewareFunction, IncomingRequestContext } from '../app.ts'
import { CookieAttributes, Cookie, setCookie } from './_cookie/utils.ts'

declare global {
	namespace Lollipop {
		interface RequestContext {
			/**
			 * An object that contains all cookies sent with a request.
			 */
			readonly cookies: { readonly [name: string]: string }
		}
		interface ResponseContext {
			/**
			 * Sets a cookie to be sent back with a value.
			 * @param key The name of the cookie
			 * @param value The value of the cookie
			 * @param options An object of cookie attributes
			 */
			setCookie(key: string, value: string, options?: CookieAttributes): Cookie
			
			/**
			 * Sets a cookie to be sent back.
			 * @param cookie A cookie instance.
			 */
			setCookie(cookie: Cookie): Cookie
		}
	}
}

export { Cookie, CookieError } from './_cookie/utils.ts'
export type { CookieAttributes } from './_cookie/utils.ts'

export default function configureCookies(): ApplicationMiddlewareFunction {
	return async (ctx: IncomingRequestContext) => {
		//@ts-ignore Has to provide the value
		ctx.request.cookies = Object.fromEntries(
			(ctx.request.headers.get('cookies') || '')
				.trim()
				.split(/ *; */g)
				.filter(Boolean)
				.map(keyValuePair => {
					const [key, value] = keyValuePair.split(/ *= */g)
					return [key, decodeURIComponent(value)]
				})
		)
		ctx.response.setCookie = function _setCookie(
			...args: [cookie: Cookie] | [key: string, value: string, options?: CookieAttributes]
		) {
			return setCookie(ctx, ...args)
		}
		return await ctx.next()
	}
}
