import type { IncomingRequestContext } from './app.ts'

export interface IncomingRequestDirectoryContext extends Pick<IncomingRequestContext, 'request' | 'response'> {
	readonly fileSystemPath: string | URL
	readonly isRoot: boolean
}

export interface ServeDirectoryOptions {
	directoryListing?: boolean | ((ctx: IncomingRequestDirectoryContext) => void | Promise<void>)
}
