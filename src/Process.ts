import { ProcessError } from "./ProcessError"
import { SpawnOptions } from "child_process"
import { FutureInstance as Future, Future as future } from "fluture"
import { spawn } from "child_process"
import { BufferingSink } from "./BufferingSink";

export function exec(command: string, opts: SpawnOptions = {}): Future<Error, Buffer> {
  return future((reject, resolve) => {
    const proc = spawn(command, { ...opts, stdio: "pipe", shell: true })

    // Combine output to a single stream
    const output = new BufferingSink()
    proc.stdout.pipe(output)
    proc.stderr.pipe(output)

    proc.addListener("error", error => reject(error))
    proc.addListener("close", code => {
      if (code !== 0) {
        reject(new ProcessError(`Process exited with status code ${code}`, code, (output.intoBuffer()).toString("utf-8")))
      } else {
        resolve(output.intoBuffer())
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