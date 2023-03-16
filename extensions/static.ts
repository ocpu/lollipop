import { IncomingRequestContext } from '../app.ts'
import { IncomingRequestRouteContext } from '../router.ts'

export interface IncomingRequestDirectoryContext extends Pick<IncomingRequestContext, 'request' | 'response'> {
	readonly fileSystemPath: string | URL
	readonly isRoot: boolean
}

export interface ServeDirectoryOptions {
	directoryListing?: boolean | ((ctx: IncomingRequestDirectoryContext) => void | Promise<void>)
}

function isRouteContext(ctx: IncomingRequestContext | IncomingRequestRouteContext<string>): ctx is IncomingRequestRouteContext<string> {
	return !('next' in ctx)
}

/**
 * Serves files from the specified path
 * Requires `allow-read` permission.
 * @param path
 *
 */
export default async function serveDirectory(
	path: string | URL,
	options?: ServeDirectoryOptions & { baseURL?: string }
) {
	const fsBasePath = path instanceof URL
		? path
		: /^\w+:\/\//.test(path)
			? new URL(path)
			: new URL('file://' + path)

	if (fsBasePath.protocol !== 'file:') {
		throw new Error('The provided URL is not local')
	}

	if (!fsBasePath.pathname.endsWith('/')) {
		fsBasePath.pathname += '/'
	}

	if ((await Deno.permissions.query({ name: 'read', path: path })).state !== 'granted') {
		console.error('To be able to serve files from directory %s read access to that directory has to be granted.', path)
		if ((await Deno.permissions.request({ name: 'read', path: path })).state !== 'granted') {
			throw new Error(`Access to directory ${path} was denied.`)
		}
	}

	try {
		const stat = await Deno.stat(path)
		if (!stat.isDirectory) throw new Error(`${path} is not a directory`)
	} catch {
		throw new Error(`${path} does not exist`)
	}
	if (typeof path === 'string') {
		path = path.replace(/\/$/, '')
	} else {
		path = new URL(path.pathname.replace(/\/$/, ''), path)
	}

	const directoryListing =
		typeof options?.directoryListing === 'boolean'
			? await defaultDirectoryListingFactory()
			: typeof options?.directoryListing === 'function'
			? options.directoryListing
			: undefined

	const { serveFile } = await import('https://deno.land/std@0.152.0/http/file_server.ts')

	return async (ctx: IncomingRequestContext | IncomingRequestRouteContext<string>) => {
		if (ctx.request.method !== 'GET') {
			if (isRouteContext(ctx)) {
				ctx.response.status = 404
				return
			} else return await ctx.next()
		}
		let reqPath = ctx.request.url.pathname
		if (options?.baseURL !== undefined && !ctx.request.url.pathname.startsWith(options.baseURL)) {
			if (isRouteContext(ctx)) {
				ctx.response.status = 404
				return
			} else return await ctx.next()
		} else if (options?.baseURL !== undefined) {
			reqPath = reqPath.substring(options.baseURL.length)
		}


		let fsPath: string | URL
		if (typeof path === 'string') {
			fsPath = path + reqPath.replace(/\/$/, '')
		} else {
			fsPath = new URL(path.pathname + reqPath.replace(/\/$/, ''), path)
		}

		let stat: Deno.FileInfo | undefined
		try {
			stat = await Deno.stat(fsPath)
		} catch {
			if (isRouteContext(ctx)) {
				ctx.response.status = 404
				return
			} else return await ctx.next()
		}

		if (stat.isDirectory) {
			if (directoryListing !== undefined) {
				return await directoryListing({
					isRoot:
						typeof fsPath === 'string'
							? typeof path === 'string'
								? fsPath === path || fsPath === path + '/'
								: fsPath === path.pathname || fsPath === path.pathname + '/'
							: typeof path === 'string'
							? fsPath.pathname === path || fsPath.pathname === path + '/'
							: fsPath.pathname === path.pathname || fsPath.pathname === path.pathname + '/',
					fileSystemPath: fsPath,
					request: ctx.request,
					response: ctx.response,
				})
			}
		} else if (stat.isFile) {
			const res = await serveFile(ctx.request.original, typeof fsPath === 'string' ? fsPath : decodeURIComponent(fsPath.pathname), {
				fileInfo: stat,
			})
			ctx.response.from(res)
			return
		}

		if (isRouteContext(ctx)) ctx.response.status = 404
		else return await ctx.next()
	}
}

export async function defaultDirectoryListingFactory() {
	const Path = await import("https://deno.land/std@0.152.0/path/mod.ts")
	const { serveFile } = await import("https://deno.land/std@0.152.0/http/file_server.ts")

	return async (ctx: IncomingRequestDirectoryContext) => {
		const entries: { entry: Deno.DirEntry; stat: Deno.FileInfo }[] = []
		for await (const entry of Deno.readDir(ctx.fileSystemPath)) {
			let fsPath: string | URL
			if (typeof ctx.fileSystemPath === 'string') {
				fsPath = Path.join(ctx.fileSystemPath, entry.name)
			} else {
				fsPath = new URL(Path.join(ctx.fileSystemPath.pathname, entry.name), ctx.fileSystemPath)
			}

			const stat = await Deno.stat(fsPath)
			if (entry.isFile && entry.name === 'index.html') {
				return ctx.response.from(
					await serveFile(ctx.request.original, typeof fsPath === 'string' ? fsPath : fsPath.pathname, {
						fileInfo: stat,
					})
				)
			}
			entries.push({ entry, stat })
		}
	}
}
