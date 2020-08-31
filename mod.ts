import Application from './Application.ts'
import Router from './router.ts'

declare global {
  namespace Lollipop {
    // The interfaces here are for extensions so that they can extend the handler context
    // when handling them in a route handler.
    interface HandlerContext {}
  }
}

export { default as Router, ResponseType, ResponseProvider as ResponseContainer } from './router.ts'
export { Extension, ServerRequest, HandlerContext } from './extension.ts'

export function createServer(developmentMode?: boolean) {
  return new Application(developmentMode ?? false)
}

/**
 * Create a new router
 */
export function createRouter() {
  return new Router()
}
