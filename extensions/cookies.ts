import { ApplicationMiddlewareFunction, IncomingRequestContext } from '../app.ts'

const VALID_COOKIE_NAME = /^[\x21\x23-\x27\x2a\x2b\x2d\x2e\x30-\x39\x41-\x5a\x5e-\x7a\x7c\x7e]+$/
const VALID_COOKIE_VALUE = /^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*$/

declare global {
	namespace Lollipop {
		interface RequestContext {
			readonly cookies: { readonly [name: string]: string }
		}
		interface ResponseContext {
			setCookie(cookie: Cookie): Cookie
			setCookie(key: string, value: string, options?: CookieAttributes): Cookie
		}
	}
}

export interface CookieAttributes {
	sameSite?: 'strict' | 'lax' | 'none'
	secure?: boolean
	httpOnly?: boolean
	domain?: string
	path?: string
	maxAge?: number | Date
	expires?: number | Date
}

export class CookieError extends Error {}

const sameSiteValueMap: Record<'strict' | 'lax' | 'none', string> = {
	strict: 'Strict',
	lax: 'Lax',
	none: 'None',
}

export class Cookie {
	public value: string
	public sameSite: 'strict' | 'lax' | 'none' | undefined
	public secure: boolean | undefined
	public httpOnly: boolean | undefined
	public domain: string | undefined
	public path: string | undefined
	public maxAge: number | Date | undefined
	public expires: number | Date | undefined

	constructor(public readonly name: string, value: string, attributes?: CookieAttributes) {
		this.value = value
		this.sameSite = attributes?.sameSite
		this.secure = attributes?.secure
		this.httpOnly = attributes?.httpOnly
		this.domain = attributes?.domain
		this.path = attributes?.path
		this.maxAge = attributes?.maxAge
		this.expires = attributes?.expires
	}

	toString() {
		let base = this.name + '=' + encodeURIComponent(this.value)
		if (this.sameSite !== undefined) base += '; SameSite=' + sameSiteValueMap[this.sameSite]
		if (this.secure !== undefined) base += '; Secure'
		if (this.httpOnly !== undefined) base += '; HttpOnly'
		if (this.domain !== undefined) base += '; Domain=' + this.domain
		if (this.path !== undefined) base += '; Path=' + this.path
		if (this.maxAge !== undefined) base += '; Max-Age=' + this.maxAge.valueOf()
		if (this.expires !== undefined) base += '; Expires=' + new Date(this.expires).toString()
		return base
	}

	static parseAll(cookie: string): Cookie[] {
		const cookies = []
		let readHead = 0
		while (true) {
			const { cookie: parsedCookie, read } = Cookie.parsePartial(cookie, readHead)
			cookies.push(parsedCookie)
			if (read === -1) break
			readHead += read
			while (readHead < cookie.length && cookie[readHead] === ' ') {
				readHead++
			}
			if (readHead >= cookie.length) break
			if (cookie[readHead] !== ',') break
			readHead++
			while (readHead < cookie.length && cookie[readHead] === ' ') {
				readHead++
			}
		}
		return cookies
	}

	static parsePartial(cookie: string, startIndex = 0): { cookie: Cookie; read: number } {
		const equalsIndex = cookie.indexOf('=', startIndex)
		if (equalsIndex === -1) throw new Error('Invalid cookie')
		const name = cookie.slice(startIndex, equalsIndex)
		if (!VALID_COOKIE_NAME.test(name)) {
			throw new CookieError('Invalid cookie name')
		}
		let value: string, lastValueIndex: number
		if (cookie.length === equalsIndex + 1) {
			return {
				cookie: new Cookie(name, ''),
				read: equalsIndex + 1 - startIndex,
			}
		} else if (cookie[equalsIndex + 1] === '"') {
			lastValueIndex = cookie.indexOf('"', equalsIndex + 2)
			if (lastValueIndex === -1) throw new CookieError('Invalid cookie value (value not wrapped correctly)')
			value = cookie.slice(equalsIndex + 2, lastValueIndex)
		} else {
			lastValueIndex = equalsIndex + 1
			while (lastValueIndex < cookie.length && cookie[lastValueIndex] !== ';' && cookie[lastValueIndex] !== ',') {
				lastValueIndex++
			}
			value = cookie.slice(equalsIndex + 1, lastValueIndex)
			lastValueIndex--
		}

		if (!VALID_COOKIE_VALUE.test(value)) {
			throw new CookieError('Invalid cookie value')
		}
		if (lastValueIndex + 1 >= cookie.length || cookie[lastValueIndex + 1] === ',') {
			return {
				cookie: new Cookie(name, decodeURIComponent(value)),
				read: lastValueIndex - startIndex,
			}
		}
		let attributesIndex = lastValueIndex + 1
		while (attributesIndex < cookie.length && cookie[attributesIndex] === ' ') {
			attributesIndex++
		}

		const attributes: {
			sameSite?: 'strict' | 'lax' | 'none'
			secure?: boolean
			httpOnly?: boolean
			domain?: string
			path?: string
			maxAge?: number | Date
			expires?: number | Date
		} = {}

		while (cookie[attributesIndex] === ';') {
			attributesIndex++
			while (attributesIndex < cookie.length && cookie[attributesIndex] === ' ') {
				attributesIndex++
			}
			let attributeNameIndex = attributesIndex
			while (
				attributeNameIndex < cookie.length &&
				cookie[attributeNameIndex] !== ' ' &&
				cookie[attributeNameIndex] !== ';' &&
				cookie[attributeNameIndex] !== ',' &&
				cookie[attributeNameIndex] !== '='
			) {
				attributeNameIndex++
			}
			const attributeName = cookie.slice(attributesIndex, attributeNameIndex)
			attributesIndex = attributeNameIndex
			if (attributesIndex + 1 >= cookie.length || cookie[attributesIndex] === ';' || cookie[attributesIndex] === ',') {
				switch (attributeName) {
					case 'Secure':
						attributes.secure = true
						break
					case 'HttpOnly':
						attributes.httpOnly = true
						break
					default:
						throw new CookieError(`Unknown attribute name: ${attributeName}`)
				}
			} else if (cookie[attributesIndex] === '=') {
				if (attributeName === 'Expires') {
					const { date, read } = parseHTTPDate(cookie, attributesIndex + 1)
					attributes.expires = date
					attributesIndex += 1 + read
				} else {
					let lastAttributeValueIndex = attributesIndex + 1
					while (
						lastAttributeValueIndex < cookie.length &&
						cookie[lastAttributeValueIndex] !== ';' &&
						cookie[lastAttributeValueIndex] !== ','
					) {
						lastAttributeValueIndex++
					}
					const attributeValue = cookie.slice(attributesIndex + 1, lastAttributeValueIndex)
					attributesIndex = lastAttributeValueIndex
					switch (attributeName) {
						case 'Max-Age': {
							attributes.maxAge = parseInt(attributeValue)
							break
						}
						case 'Domain': {
							attributes.domain = attributeValue.trim()
							break
						}
						case 'Path': {
							attributes.path = attributeValue.trim()
							break
						}
						case 'SameSite':
							switch (attributeValue.trim()) {
								case 'Strict':
									attributes.sameSite = 'strict'
									break
								case 'Lax':
									attributes.sameSite = 'lax'
									break
								case 'None':
									attributes.sameSite = 'none'
									break
								default:
									throw new CookieError(`Unknown attribute value for SameSite: ${attributeValue}`)
							}
							break
						default:
							throw new CookieError(`Unknown attribute name: ${attributeName} with value ${attributeValue}`)
					}
				}
			}
		}

		return {
			cookie: new Cookie(name, decodeURIComponent(value), attributes),
			read: attributesIndex - startIndex,
		}
	}
}

const wkday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekday = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function parseHTTPDate(string: string, startIndex = 0): { date: Date; read: number } {
	const nextComma = string.indexOf(',', startIndex)
	const nextSpace = string.indexOf(' ', startIndex)
	let lastValuableIndex: number
	if (nextComma === -1 || nextSpace !== nextComma + 1) {
		// ASCTIME Date
		if (nextSpace !== startIndex + 3 || !wkday.includes(string.slice(startIndex, nextSpace))) {
			throw new Error('Illegal Date')
		}
		if (!month.includes(string.slice(nextSpace + 1, nextSpace + 4))) {
			throw new Error('Illegal Date')
		}
		if (string[nextSpace + 4] !== ' ') {
			throw new Error('Illegal Date')
		}
		if (
			!(
				(string[nextSpace + 5] === ' ' || digits.includes(string[nextSpace + 5])) &&
				digits.includes(string[nextSpace + 6])
			)
		) {
			throw new Error('Illegal Date')
		}
		lastValuableIndex = nextSpace + 6
	} else if (nextComma === startIndex + 3 && nextSpace === nextComma + 1) {
		// RFC1123 Date
		if (!wkday.includes(string.slice(startIndex, nextComma))) {
			throw new Error('Illegal Date')
		}
		if (!(digits.includes(string[nextSpace + 1]) && digits.includes(string[nextSpace + 2]))) {
			throw new Error('Illegal Date')
		}
		if (string[nextSpace + 3] !== ' ') {
			throw new Error('Illegal Date')
		}
		if (!month.includes(string.slice(nextSpace + 4, nextSpace + 7))) {
			throw new Error('Illegal Date')
		}
		if (string[nextSpace + 7] !== ' ') {
			throw new Error('Illegal Date')
		}
		if (!(digits.includes(string[nextSpace + 8]) && digits.includes(string[nextSpace + 9]))) {
			throw new Error('Illegal Date')
		}
		lastValuableIndex = nextSpace + 9
	} else if (
		nextComma <= startIndex + 9 &&
		weekday.includes(string.slice(startIndex, nextComma)) &&
		nextSpace === nextComma + 1
	) {
		// RFC850 Date
		if (!wkday.includes(string.slice(startIndex, nextComma))) {
			throw new Error('Illegal Date')
		}
		if (!(digits.includes(string[nextSpace + 1]) && digits.includes(string[nextSpace + 2]))) {
			throw new Error('Illegal Date')
		}
		if (string[nextSpace + 3] !== '-') {
			throw new Error('Illegal Date')
		}
		if (!month.includes(string.slice(nextSpace + 4, nextSpace + 7))) {
			throw new Error('Illegal Date')
		}
		if (string[nextSpace + 7] !== '-') {
			throw new Error('Illegal Date')
		}
		if (!(digits.includes(string[nextSpace + 8]) && digits.includes(string[nextSpace + 9]))) {
			throw new Error('Illegal Date')
		}
		lastValuableIndex = nextSpace + 9
	} else {
		throw new Error('Illegal Date')
	}
	if (string[lastValuableIndex + 1] !== ' ') {
		throw new Error('Illegal Date')
	}
	if (!(digits.includes(string[lastValuableIndex + 2]) && digits.includes(string[lastValuableIndex + 3]))) {
		throw new Error('Illegal Date')
	}
	if (string[lastValuableIndex + 4] !== ':') {
		throw new Error('Illegal Date')
	}
	if (!(digits.includes(string[lastValuableIndex + 5]) && digits.includes(string[lastValuableIndex + 6]))) {
		throw new Error('Illegal Date')
	}
	if (string[lastValuableIndex + 7] !== ':') {
		throw new Error('Illegal Date')
	}
	if (!(digits.includes(string[lastValuableIndex + 8]) && digits.includes(string[lastValuableIndex + 9]))) {
		throw new Error('Illegal Date')
	}
	if (string[lastValuableIndex + 10] !== ' ') {
		throw new Error('Illegal Date')
	}
	if (string[lastValuableIndex + 11] !== 'G') {
		throw new Error('Illegal Date')
	}
	if (string[lastValuableIndex + 12] !== 'M') {
		throw new Error('Illegal Date')
	}
	if (string[lastValuableIndex + 13] !== 'T') {
		throw new Error('Illegal Date')
	}
	const date = new Date(string.slice(startIndex, lastValuableIndex + 14))
	if (isNaN(date.getTime())) {
		throw new Error('Illegal Date')
	}
	return { date, read: lastValuableIndex + 14 - startIndex }
}

export default function cookies(): ApplicationMiddlewareFunction {
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
		ctx.response.setCookie = function setCookie(
			...args: [cookie: Cookie] | [key: string, value: string, options?: CookieAttributes]
		) {
			const cookie: Cookie =
				args[0] instanceof Cookie
					? args[0]
					: new Cookie(...(args as [key: string, value: string, options?: CookieAttributes]))

			const currentSource = ctx.response.headers.get('set-cookie')
			const cookies = currentSource === null ? [] : Cookie.parseAll(currentSource)
			ctx.response.headers.set(
				'set-cookie',
				cookies
					.filter(it => it.name !== cookie.name)
					.concat([cookie])
					.join(', ')
			)

			return cookie
		}
		await ctx.next()
	}
}
