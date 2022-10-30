import * as Path from 'std/path/mod.ts'
import { ApplicationMiddlewareFunction } from '../app.ts'

declare global {
	namespace Lollipop {
		interface ResponseContext {
			render(template: string, params?: Params): Promise<void>
		}
	}
}

export interface TemplateResult {
	readonly template: string
	readonly params: Params
	readonly file: string
	readonly engine: RenderEngine
	readonly result: Promise<string>
}

export type Params = Record<string, unknown>

export interface RenderEngine {
	readonly extensions: readonly string[]
	render(source: string, params: Params): string
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

export default function templating({ views, engines }: TemplatingOptions): ApplicationMiddlewareFunction {
	return async ctx => {
		ctx.response.render = async function render(template: string, params: Record<string, unknown>) {
			const result = await createResult({ views, engines }, template, params ?? {})
			ctx.response.html(result.result)
		}

		await ctx.next()
	}
}

const templateCache: { [template: string]: [string, RenderEngine] } = {}

async function createResult({ views, engines }: TemplatingOptions, template: string, params: Params) {
	let opts
	if (!(template in templateCache)) {
		opts = templateCache[template]
	} else {
		const templatePath = Path.resolve(views, template.replace(/\//g, Path.SEP))
		const directory = Path.dirname(templatePath)
		const filename = Path.basename(templatePath)
		entries: for await (const entry of Deno.readDir(directory)) {
			if (entry.isFile && entry.name.startsWith(filename + '.')) {
				const ext = entry.name.replace(filename, '').substring(1)
				for (const engine of engines) {
					if (engine.extensions.includes(ext)) {
						opts = templateCache[template] = [Path.join(directory, entry.name), engine]
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
	}
	return result
}
