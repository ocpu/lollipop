import { ServerRequest } from 'https://deno.land/std/http/server.ts'
import { HandlerContext, ResponseType } from './router.ts'
import Application from './Application.ts'

export { ServerRequest } from 'https://deno.land/std/http/server.ts'
export { HandlerContext } from './router.ts'
export { default as Application } from './Application.ts'

export interface Extension {
  readonly name: string

  onConnection?(req: ServerRequest, application: Application): Promise<void> | void
  provideResponseHeaders?(headers: Headers, req: ServerRequest, context: HandlerContext): Promise<void> | void
  transformResult?(result: any, context: HandlerContext): ResponseType | Promise<ResponseType>
  provideValuesForRouteContext?(
    req: ServerRequest,
    ctx: HandlerContext
  ): Promise<Partial<HandlerContext>> | Partial<HandlerContext>
}
