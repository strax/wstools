export class ProcessError extends Error {
  constructor(message: string, readonly code: number) {
    super(message)
  }
}
