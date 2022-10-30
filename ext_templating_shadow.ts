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

export interface TemplatingOptions {
	/**
	 * The path to where the view templates are.
	 */
	readonly views: string
	/**
	 * A list of available template rendering engines.
	 */
	readonly engines: readonly RenderEngine[]
}
