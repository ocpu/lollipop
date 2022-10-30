import { ApplicationMiddlewareFunction } from '../mod.ts'

type CSPValue =
	| 'none'
	| 'unsafe-inline'
	| 'unsafe-eval'
	| 'unsafe-hashes'
	| 'unsafe-allow-redirects'
	| 'strict-dynamic'
	| 'report-sample'
	| 'self'
	| string
type CSPDirective =
	| 'connect-src'
	| 'default-src'
	| 'frame-src'
	| 'img-src'
	| 'manifest-src'
	| 'media-src'
	| 'object-src'
	| 'prefetch-src'
	| 'script-src'
	| 'script-src-elem'
	| 'script-src-attr'
	| 'style-src'
	| 'style-src-elem'
	| 'style-src-attr'
	| 'worder-src'
	
interface HeaderBuilder {
	set(name: string, value: string | number): HeaderBuilder
	contentTypeOptions(value: 'nosniff'): HeaderBuilder
	frameOptions(value: 'deny'): HeaderBuilder
	frameOptions(value: 'sameorigin'): HeaderBuilder
	frameOptions(value: 'allow-from', uri: string): HeaderBuilder
	referrerPolicy(value: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url'): HeaderBuilder
	contentSecurityPolicy(value: Partial<Record<CSPDirective, CSPValue | CSPValue[]>>): HeaderBuilder
}
function isCSPKeyword(value: string) {
	switch (value) {
		case 'unsafe-inline':
		case 'unsafe-eval':
		case 'unsafe-hashes':
		case 'unsafe-allow-redirects':
		case 'strict-dynamic':
		case 'report-sample':
		case 'self':
		case 'none': return true
		default: return false
	}
}

type HeaderBuilderFunction = (builder: HeaderBuilder) => void

export default function configureDefaultHeaders(headers: HeadersInit | HeaderBuilderFunction): ApplicationMiddlewareFunction {
	const headersObject = new Headers(typeof headers === 'function' ? [] : headers)
	if (typeof headers === 'function') headers(createHeaderBuilder(headersObject))
	const entries = headersObject.entries()
	return async ctx => {
		for (const [name, value] of entries) {
			ctx.response.headers.append(name, value)
		}
		return await ctx.next()
	}
}

function createHeaderBuilder(object: Headers): HeaderBuilder {
	let self: HeaderBuilder
	return self = {
		set(name, value) {
			object.set(name, String(value))
			return this
		},
		contentTypeOptions: value => self.set('X-Content-Type-Options', value),
		contentSecurityPolicy: def => self.set('Content-Security-Policy', Object.entries(def)
			.map(([directive, value]) => directive + ' ' + (Array.isArray(value)
				? value.map(val => isCSPKeyword(val) ? `'${val}'` : val).join(' ')
				: isCSPKeyword(value) ? `'${value}'` : value))
			.join(';')),
		frameOptions: (value, uri?: string) => self.set('X-Frame-Options', value.toUpperCase() + (uri === undefined ? '' : ' ' + uri)),
		referrerPolicy: (value) => self.set('Referrer-Policy', value),
	}
}
