export class ProcessError extends Error {
  constructor(message: string, readonly code: number, readonly output: string) {
    super(message)
  }
}
