export default class HTTPError extends Error {
	public statusCode: number
	public cause: Error | undefined

	constructor(message: string)
	constructor(message: string, statusCode: number)
	constructor(message: string, cause?: Error)
	constructor(message: string, statusCode: number, cause?: Error)
	constructor(message: string, statusCodeOrCause?: number | Error, cause?: Error) {
		super(message)
		if (statusCodeOrCause) {
			if (statusCodeOrCause instanceof Error) {
				this.cause = statusCodeOrCause
				if (statusCodeOrCause instanceof HTTPError) this.statusCode = statusCodeOrCause.statusCode
				else this.statusCode = 500
			} else {
				this.statusCode = statusCodeOrCause
			}
		} else this.statusCode = 500
		if (cause) this.cause = cause
	}
}
