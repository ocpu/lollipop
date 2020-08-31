import * as path from 'https://deno.land/std/path/mod.ts'
import { Extension, ServerRequest } from '../extension.ts'
import { HandlerContext, ResponseProvider } from '../router.ts'

declare global {
  namespace Lollipop {
    interface HandlerContext {
      render(template: string, params?: Params): Promise<TemplateResult>
    }
  }
}

export interface TemplateResult extends ResponseProvider {
  readonly template: string
  readonly params: Params
  readonly file: string
  readonly engine: RenderEngine
  readonly result: Promise<string>
}

export interface Params {
  [key: string]: any
}

export interface RenderEngine {
  readonly extensions: readonly string[]
  render(source: string, params: Params): string
}

const templateCache: { [template: string]: [string, RenderEngine] } = {}

class Templating implements Extension {
  readonly name = 'Templating'
  constructor(public readonly views: string, public readonly engines: readonly RenderEngine[]) {}

  provideValuesForRouteContext?(
    req: ServerRequest,
    ctx: HandlerContext
  ): Promise<Partial<HandlerContext>> | Partial<HandlerContext> {
    return {
      render: (template, params) => this.createResult(template, params ?? {}),
    }
  }

  async createResult(template: string, params: Params) {
    let opts
    if (!(template in templateCache)) {
      opts = templateCache[template]
    } else {
      const templatePath = path.resolve(this.views, template.replace(/\//g, path.SEP))
      const directory = path.dirname(templatePath)
      const filename = path.basename(templatePath)
      entries: for await (const entry of Deno.readDir(directory)) {
        if (entry.isFile && entry.name.startsWith(filename + '.')) {
          const ext = entry.name.replace(filename, '').substring(1)
          for (const engine of this.engines) {
            if (engine.extensions.includes(ext)) {
              opts = templateCache[template] = [path.join(directory, entry.name), engine]
              break entries
            }
          }
        }
      }
      throw new Error(`Unable to find template file or suitable render engine for template '${template}'`)
    }
    const [file, engine] = opts
    let _result: Promise<string> | undefined
    const result: TemplateResult = {
      template,
      params,
      file,
      engine,
      get result() {
        if (_result === undefined) {
          _result = Deno.readTextFile(file).then(text => engine.render(text, params))
        }
        return _result
      },
      provideResponse(ctx) {
        ctx.setHeader('Content-Type', 'text/html')
        return result.result
      },
    }
    return result
  }
}

type TemplatingOptions = {
  /**
   * The path to where the view templates are.
   */
  readonly views: string
  /**
   * A list of available template rendering engines.
   */
  readonly engines: readonly RenderEngine[]
}

export function createTemplating({ views, engines }: TemplatingOptions) {
  return new Templating(views, engines)
}
