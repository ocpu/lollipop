export interface CookieAttributes {
	sameSite?: 'strict' | 'lax' | 'none'
	secure?: boolean
	httpOnly?: boolean
	domain?: string
	path?: string
	maxAge?: number | Date
	expires?: number | Date
}
