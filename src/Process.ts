import { ProcessError } from "./ProcessError"
import { SpawnOptions } from "child_process"
import { FutureInstance as Future, Future as future } from "fluture"
import { spawn } from "child_process"
import { BufferingSink } from "./BufferingSink";
import { Writable } from "stream";

export interface ExecOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  output?: Writable
}

export function exec(command: string, { env, cwd, output }: ExecOptions = {}): Future<Error, number> {
  return future((reject, resolve) => {
    const proc = spawn(command, { stdio: "pipe", shell: true, env, cwd })

    if (output) {
      proc.stdout.pipe(output, { end: false })
      proc.stderr.pipe(output, { end: false })
    }

    proc.addListener("error", error => reject(error))
    proc.addListener("close", code => {
      if (output) output.end()
      if (code !== 0) {
        reject(new ProcessError(`Process exited with status code ${code}`, code))
      } else {
        resolve(code)
      }
    })

    // Cancellation
    return () => {
      if (!proc.killed) {
        proc.kill("SIGTERM")
      }
    }
  })
}