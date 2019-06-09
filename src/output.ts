import { EOL } from "os"
import { Writable as WritableStream } from "stream"
import chalk from "chalk"

class StreamWrapper {
  constructor(private stream: WritableStream) {}

  write(content: string) {
    this.stream.write(content)
  }

  writeLine(content: string) {
    this.stream.write(content + EOL)
  }
}

export const stdout = new StreamWrapper(process.stdout)
export const stderr = new StreamWrapper(process.stderr)

export function debug(message: string) {
  stderr.writeLine(chalk.dim(`${message}`))
}

export function info(message: string) {
  stdout.writeLine(message)
}

export function error(message: string) {
  stderr.writeLine(chalk.red(message))
}
