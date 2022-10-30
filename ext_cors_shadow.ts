import type { IncomingRequestContext } from './app.ts'

export interface CORSConfig {
	addMapping(pathnamePattern: string): CORSConfigMapping
	addMapping(pathnamePattern: string, config?: Omit<CORSMatcher, 'pattern'> | undefined): CORSConfigMapping
}
export interface CORSConfigMapping {
	readonly and: CORSConfig
	allowedOrigin(...origins: string[]): CORSConfigMapping
	allowedOrigin(getOrigins: (ctx: IncomingRequestContext) => string[] | Promise<string[]>): CORSConfigMapping
	allowedMethods(...methods: string[]): CORSConfigMapping
	allowedMethods(getMethods: (ctx: IncomingRequestContext) => string[] | Promise<string[]>): CORSConfigMapping
	allowedHeaders(...headers: string[]): CORSConfigMapping
	allowedHeaders(getHeaders: (ctx: IncomingRequestContext) => string[] | Promise<string[]>): CORSConfigMapping
	allowCredentials(): CORSConfigMapping
	allowCredentials(allowed: boolean): CORSConfigMapping
	allowCredentials(getAllowed: (ctx: IncomingRequestContext) => boolean | Promise<boolean>): CORSConfigMapping
	maxAge(deltaSeconds: number): CORSConfigMapping
	maxAge(getDeltaSeconds: (ctx: IncomingRequestContext) => number | Promise<number>): CORSConfigMapping
}
export interface CORSMatcher {
	pattern: URLPattern
	origin?(ctx: IncomingRequestContext): string[] | Promise<string[]>
	methods?(ctx: IncomingRequestContext): string[] | Promise<string[]>
	headers?(ctx: IncomingRequestContext): string[] | Promise<string[]>
	credentials?(ctx: IncomingRequestContext): boolean | Promise<boolean>
	maxAge?(ctx: IncomingRequestContext): number | Promise<number>
}
