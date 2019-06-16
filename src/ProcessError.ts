export class ProcessError extends Error {
  constructor(message: string, readonly code: number, readonly stderr?: string) {
    super(message)
  }
}
