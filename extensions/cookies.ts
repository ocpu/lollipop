import { Extension, ServerRequest, HandlerContext } from '../extension.ts'

declare global {
  namespace Lollipop {
    interface HandlerContext {
      readonly cookies: { [name: string]: string }
      setCookie(cookie: Cookie): Cookie
      setCookie(key: string, value: string, options?: CookieOptions): Cookie
    }
  }
}

export interface CookieOptions {
  sameSite?: 'strict' | 'lax' | 'none'
  secure?: boolean
  httpOnly?: boolean
  domain?: string
  path?: string
  maxAge?: number | Date
  expires?: number | Date
}

export class Cookie {
  private _value: string
  private _changed: boolean
  private _sameSite?: 'strict' | 'lax' | 'none'
  private _secure?: boolean
  private _httpOnly?: boolean
  private _domain?: string
  private _path?: string
  private _maxAge?: number | Date
  private _expires?: number | Date

  constructor(public readonly key: string, value: string, options?: CookieOptions) {
    this._value = value
    this._changed = false
    this._sameSite = Object(options)._sameSite
    this._secure = Object(options)._secure
    this._httpOnly = Object(options)._httpOnly
    this._domain = Object(options)._domain
    this._path = Object(options)._path
    this._maxAge = Object(options)._maxAge
    this._expires = Object(options)._expires
  }

  private set<K extends keyof Cookie>(key: K, value: Cookie[K]) {
    if (!this._changed)
      //@ts-ignore
      this._changed = this['_' + key] !== value
    //@ts-ignore
    this['_' + key] = value
  }

  get changed() {
    return this._changed
  }
  get value() {
    return this._value
  }
  set value(value) {
    this.set('value', value)
  }
  get sameSite() {
    return this._sameSite || 'none'
  }
  set sameSite(sameSite) {
    this.set('sameSite', sameSite)
  }
  get secure() {
    return this._secure || false
  }
  set secure(secure) {
    this.set('secure', secure)
  }
  get httpOnly() {
    return this._httpOnly || false
  }
  set httpOnly(httpOnly) {
    this.set('httpOnly', httpOnly)
  }
  get domain() {
    return this._domain
  }
  set domain(domain) {
    this.set('domain', domain)
  }
  get path() {
    return this._path
  }
  set path(path) {
    this.set('path', path)
  }
  get maxAge() {
    return this._maxAge instanceof Date ? this._maxAge : new Date(this._maxAge || 0)
  }
  set maxAge(maxAge: number | Date) {
    this.set('maxAge', maxAge)
  }
  get expires() {
    return this._expires instanceof Date ? this._expires : new Date(this._expires || 0)
  }
  set expires(expires: number | Date) {
    this.set('expires', expires)
  }

  toString() {
    let base = this.key + '=' + encodeURIComponent(this.value)
    if (this._sameSite) base += '; SameSite=' + this._sameSite[0].toUpperCase() + this._sameSite.slice(1)
    if (this._secure) base += '; Secure'
    if (this._httpOnly) base += '; HttpOnly'
    if (this._domain) base += '; Domain=' + this._domain
    if (this._path) base += '; Path=' + this._path
    if (this._maxAge) base += '; Max-Age=' + this._maxAge.valueOf()
    if (this._expires) base += '; Expires=' + new Date(this._expires).toString()
    return base
  }

  static parse(cookie: string): Cookie {
    const meta: {
      sameSite?: 'strict' | 'lax' | 'none'
      secure?: boolean
      httpOnly?: boolean
      domain?: string
      path?: string
      maxAge?: number | Date
      expires?: number | Date
    } = {}
    const items = cookie.split(/ *; */g)
    const keyPair = items.shift()
    if (!keyPair) throw new Error('Invalid cookie string')
    const [key, value] = keyPair.trim().split('=')
    items.forEach(item => {
      const value = item.trim()
      if (value.startsWith('SameSite=')) meta.sameSite = value.slice(9).toLowerCase() as 'strict' | 'lax' | 'none'
      if (value === 'Secure') meta.secure = true
      if (value === 'HttpOnly') meta.httpOnly = true
      if (value.startsWith('Domain=')) meta.domain = value.slice(7)
      if (value.startsWith('Path=')) meta.path = value.slice(5)
      if (value.startsWith('Max-Age=')) meta.maxAge = new Date(+value.slice(8))
      if (value.startsWith('Expires=')) meta.expires = new Date(value.slice(8))
    })
    return new Cookie(key, decodeURIComponent(value), meta)
  }
}

export default class CookieExtension implements Extension {
  readonly name = 'Cookies'
  private responseCookieListMap = new WeakMap<ServerRequest, Cookie[]>()

  provideValuesForRouteContext(req: ServerRequest, ctx: HandlerContext): Promise<Partial<HandlerContext>> | Partial<HandlerContext> {
    const cookieList: Cookie[] = []
    this.responseCookieListMap.set(req, cookieList)
    return {
      //@ts-ignore Has to provide the key
      cookies: Object.fromEntries(
        (req.headers.get('cookies') || '')
          .trim()
          .split(/ *; */g)
          .filter(Boolean)
          .map(keyValuePair => keyValuePair.split(/ *= */g))
      ),
      setCookie(key: string | Cookie, value?: string, options?: CookieOptions) {
        let cookie: Cookie
        if (key instanceof Cookie) {
          cookie = key
        } else if (typeof value === 'string') {
          cookie = new Cookie(key, value, options)
        } else {
          throw new Error('Invalid signature for setCookie')
        }
        for (const existingCookie of cookieList) {
          if (existingCookie.key === cookie.key)
            return existingCookie
        }
        cookieList.push(cookie)
        return cookie
      }
    }
  }

  provideResponseHeaders(headers: Headers, req: ServerRequest, ctx: HandlerContext) {
    const cookieList = this.responseCookieListMap.get(req)
    if (Array.isArray(cookieList)) {
      this.responseCookieListMap.delete(req)
      for (const cookie of cookieList)
        headers.append('Set-Cookie', cookie.toString())
    }
  }
}
