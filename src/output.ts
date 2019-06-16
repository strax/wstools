import chalk from "chalk"
import { EOL } from "os"
import { PassThrough } from "stream"

const IS_DEBUG = !!process.env["WSTOOLS_DEBUG"]

class LineStream extends PassThrough {
  writeLine(content: string) {
    this.write(content + EOL)
  }
}

export const stdout = new LineStream()
export const stderr = new LineStream()

export function debug(message: string) {
  if (IS_DEBUG) {
    stderr.writeLine(chalk.dim(`${message}`))
  }
}

export function info(message: string) {
  stdout.writeLine(message)
}

export function error(message: string) {
  stderr.writeLine(chalk.red(message))
}
