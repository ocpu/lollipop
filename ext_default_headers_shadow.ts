export type CSPValue =
	| 'none'
	| 'unsafe-inline'
	| 'unsafe-eval'
	| 'unsafe-hashes'
	| 'unsafe-allow-redirects'
	| 'strict-dynamic'
	| 'report-sample'
	| 'self'
	| string
export type CSPDirective =
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

export interface HeaderBuilder {
	set(name: string, value: string | number): HeaderBuilder
	contentTypeOptions(value: 'nosniff'): HeaderBuilder
	frameOptions(value: 'deny'): HeaderBuilder
	frameOptions(value: 'sameorigin'): HeaderBuilder
	frameOptions(value: 'allow-from', uri: string): HeaderBuilder
	referrerPolicy(value: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url'): HeaderBuilder
	contentSecurityPolicy(value: Partial<Record<CSPDirective, CSPValue | CSPValue[]>>): HeaderBuilder
}

export type HeaderBuilderFunction = (builder: HeaderBuilder) => void
