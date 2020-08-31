import {
  HTTPOptions,
  HTTPSOptions,
  Response,
  serve,
  Server,
  ServerRequest,
  serveTLS,
} from 'https://deno.land/std/http/server.ts'
import { encoder } from 'https://deno.land/std/encoding/utf8.ts'
import { Extension } from './extension.ts'
import HTTPError from './HTTPError.ts'
import Router, { HandlerContext, HandleSuccess, ResponseType } from './router.ts'
import { getParsedQuery, getPathname, isDenoReader, isResponseProvider } from './util.ts'

/**
 *
 */
export default class Application extends Router {
  constructor(private developmentMode: boolean) {
    super()
  }

  private extensions: Extension[] = []
  install(extension: Extension): Application {
    for (const ext of this.extensions) {
      if (ext.name === extension.name) {
        return this
      }
    }
    this.extensions.push(extension)
    return this
  }

  serve(addr: number | string | HTTPOptions) {
    if (typeof addr === 'number') addr = { port: addr }
    return this.startServer(serve(addr))
  }

  serveTLS(options: HTTPSOptions & { redirectHTTP?: boolean | number | string | { port?: number; host: string } }) {
    if (typeof options.redirectHTTP === 'boolean' && options.redirectHTTP && options.port === 443)
      this.startRedirectServer(
        {
          hostname: options.hostname,
          port: 80,
        },
        ''
      )
    if (typeof options.redirectHTTP === 'string' && options.port === 443)
      this.startRedirectServer(
        {
          hostname: options.hostname,
          port: 80,
        },
        options.redirectHTTP
      )
    if (typeof options.redirectHTTP === 'number')
      this.startRedirectServer(
        {
          hostname: options.hostname,
          port: options.redirectHTTP,
        },
        ''
      )
    if (typeof options.redirectHTTP === 'object') {
      if (options.redirectHTTP.port === undefined && options.port === 443)
        this.startRedirectServer(
          {
            hostname: options.hostname,
            port: 80,
          },
          options.redirectHTTP.host
        )
      else if (typeof options.redirectHTTP.port === 'number')
        this.startRedirectServer(
          {
            hostname: options.hostname,
            port: options.redirectHTTP.port,
          },
          options.redirectHTTP.host
        )
    }
    return this.startServer(serveTLS(options))
  }

  private async startRedirectServer(options: HTTPOptions, redirectHostname: string) {
    for await (const req of serve(options)) {
      req.respond({
        status: 301,
        headers: new Headers({
          Location: `https://${req.headers.get('origin') || redirectHostname || options.hostname || ''}${req.url}`,
        }),
      })
    }
  }

  private async startServer(server: Server) {
    for await (const req of server) {
      const response = await this.provideResponse(req)
      if (response) req.respond(response)
    }
  }

  private get404Response(ctx: HandlerContext): Response {
    // TODO: Custom error case
    return {
      status: 404,
      headers: new Headers({
        'Content-Type': 'application/json',
        'Content-Length': '47',
      }),
      body: encoder.encode('{"status":404,"message":"Route does not exist"}'),
    }
  }

  private getErrorResponse(error: any, responseHeaders: Headers, ctx: HandlerContext): Response {
    // TODO: Custom error case

    let statusCode = 500, data: any
    if (error instanceof Error) {
      if (error instanceof HTTPError) statusCode = error.statusCode
      data = {
        status: statusCode,
        message: this.developmentMode ? error.message : 'Internal Server Error',
        cause: this.developmentMode ? (error as HTTPError).cause?.message : undefined
      }
    } else {
      const message = typeof error === 'string' ? error : 'Internal Server Error'
      data = {
        status: statusCode,
        message: this.developmentMode ? message : 'Internal Server Error',
      }
    }
    const res = encoder.encode(JSON.stringify(data))
    return {
      status: statusCode,
      headers: new Headers({
        'Content-Type': 'application/json',
        'Content-Length': res.byteLength.toString(),
      }),
      body: res,
    }
  }

  async provideResponse(req: ServerRequest): Promise<Response | undefined> {
    await Promise.allSettled(
      this.extensions
        .map(it => it.onConnection)
        .filter(Boolean)
        .map(fn => fn!(req, this))
    )
    const responseHeaders = new Headers()
    const context: HandlerContext = createDefaultContext(req, responseHeaders)
    for (const extension of this.extensions)
      if (extension.provideValuesForRouteContext)
        Object.assign(context, await extension.provideValuesForRouteContext(req, context))

    try {
      const result = await this.handle(req, context)
      if (result instanceof HandleSuccess) {
        const provideResponseHeadersPromises = []

        for (const extension of this.extensions)
          if (extension.provideResponseHeaders)
            provideResponseHeadersPromises.push(extension.provideResponseHeaders(responseHeaders, req, context))

        await Promise.allSettled(provideResponseHeadersPromises)

        let res: ResponseType = result.value
        if (isResponseProvider(res)) {
          res = await res.provideResponse(context)
        }
        for (const extension of this.extensions) {
          if (typeof extension.transformResult === 'function') {
            res = await extension.transformResult.call(extension, res, context)
          }
        }
        if (isResponseProvider(res)) {
          res = await res.provideResponse(context)
        }

        const body = convertToBody(res, context)

        if (body !== undefined) {
          return {
            status: context.status(),
            headers: responseHeaders,
            body: body,
          }
        } else if (typeof res !== 'undefined') {
          throw new HTTPError('Developer Error: Unable ')
        }
      } else {
        return this.get404Response(context)
      }
    } catch (error) {
      console.error(error)
      return this.getErrorResponse(error, responseHeaders, context)
    }
  }
}

function convertToBody(res: ResponseType, ctx: HandlerContext): Uint8Array | Deno.Reader | undefined {
  if (res instanceof Uint8Array || isDenoReader(res)) {
    // Handle if the result was a stream or binary data
    if (!ctx.headers.has('Content-Type')) ctx.headers.append('Content-Type', 'application/octet-stream')

    if (res instanceof Uint8Array && !ctx.headers.has('Content-Length'))
      ctx.headers.append('Content-Length', res.byteLength.toString())

    return res
  } else if (res === null) {
    // Handle the response is null (separate to undefined)
    if (!ctx.headers.has('Content-Type')) ctx.headers.append('Content-Type', 'application/json')
    ctx.headers.set('Content-Length', '4')
    return encoder.encode('null')
  } else if (typeof res !== 'undefined') {
    // Handle single value responses
    if (typeof res === 'string') {
      const body = encoder.encode(res)
      if (!ctx.headers.has('Content-Length')) ctx.headers.set('Content-Length', body.byteLength.toString())
      return body
    } else if (ctx.headers.has('Content-Type')) {
      const body = encoder.encode('' + res)
      if (!ctx.headers.has('Content-Length')) ctx.headers.set('Content-Length', body.byteLength.toString())
      return body
    } else {
      const body = encoder.encode(JSON.stringify(res))
      ctx.headers.set('Content-Type', 'application/json')
      ctx.headers.set('Content-Length', body.byteLength.toString())
      return body
    }
  }
}

function createDefaultContext(req: ServerRequest, responseHeaders: Headers) {
  let storedStatus = 200
  const context: HandlerContext = {
    url: req.url,
    path: getPathname(req.url),
    query: getParsedQuery(req.url),
    method: req.method,
    headers: req.headers,
    conn: req.conn,
    done: req.done,
    params: {},
    get body(): Deno.Reader {
      return req.body
    },
    //@ts-ignore
    status(status?: number) {
      if (typeof status === 'number') {
        storedStatus = status
        return context
      } else {
        return storedStatus
      }
    },
    setHeaders(headers: { [name: string]: string | string[] }): HandlerContext {
      for (const name in headers) {
        if (headers.hasOwnProperty(name)) {
          context.setHeader(name, headers[name])
        }
      }
      return context
    },
    setHeader(name: string, value: string | string[]): HandlerContext {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          responseHeaders.set(name, value[0])
          if (value.length > 1) {
            for (const val of value.slice(1)) {
              responseHeaders.append(name, val)
            }
          }
        }
      } else {
        responseHeaders.set(name, value)
      }
      return context
    },
    appendHeader(name: string, value: string | string[]): HandlerContext {
      if (Array.isArray(value)) {
        for (const val of value) {
          responseHeaders.append(name, val)
        }
      } else {
        responseHeaders.append(name, value)
      }
      return context
    },
    return<R extends ResponseType>(value: R): R {
      return value
    },
  }

  return context
}
