import { Deferred } from "@esfx/async"
import chalk from "chalk"
import { spawn, SpawnOptions } from "child_process"
import { PassThrough, Readable } from "stream"
import { readManifest } from "./manifest"
import { ProcessError } from "./ProcessError"
import { Timer } from "./Timer"

export interface ExecutionSummary {
  workspace: string
  command: string
  succeeded: boolean
  stdout?: string
  stderr?: string
  duration: number
}

async function toBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Array<Buffer> = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

interface ProcessResult {
  code: number
  output: Buffer
}

async function exec(command: string, opts: SpawnOptions = {}): Promise<ProcessResult> {
  const barrier = new Deferred<number>()
  const proc = spawn(command, { ...opts, stdio: "pipe", shell: true })
  const stdio = new PassThrough()
  proc.stdout.pipe(stdio)
  proc.stderr.pipe(stdio)
  proc.on("exit", code => {
    barrier.resolve(code!)
  })
  const code = await barrier.promise
  const output = await toBuffer(stdio)
  return { code, output }
}

export async function runCommand(workspace: Workspace, command: Array<string>) {
  return new Promise((resolve, reject) => {
    console.log(chalk.blue(workspace.name + ":"), command.join(" "))
    const [program, ...args] = command
    const proc = spawn(program, args, {
      env: process.env
    })
    proc.on("exit", (code: number) => {
      if (code > 0) {
        reject(new ProcessError(`Process exited with status code ${code}`, code))
      } else {
        resolve()
      }
    })
  })
}

export async function runScript(
  workspace: Workspace,
  script: string,
  args: Array<string> = []
): Promise<ExecutionSummary> {
  const manifest = await readManifest(workspace.path)
  if (!manifest.scripts) {
    throw new Error(`no "scripts" field in package.json`)
  }
  const command = manifest.scripts[script]
  if (!command) {
    throw new Error(`no script named "${script} found`)
  }
  // stdout.writeLine(chalk.blue(workspace.name + ":") + " " + [command, ...args].join(" "))
  const timer = Timer()
  try {
    const { code, output } = await exec([command, ...args].join(" "), {
      cwd: workspace.path,
      env: process.env
    })
    if (code !== 0) {
      throw new ProcessError(`Process exited with code ${code}`, code, output.toString("utf-8"))
    }
    const duration = timer()
    return {
      workspace: workspace.name,
      command: [command, ...args].join(" "),
      stdout: output.toString("utf-8"),
      succeeded: true,
      duration
    }
  } catch (err) {
    if (err instanceof ProcessError) {
      return {
        workspace: workspace.name,
        command: [command, ...args].join(" "),
        succeeded: false,
        duration: timer(),
        stderr: err.stderr
      }
    } else {
      throw err
    }
  }
}
