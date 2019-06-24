import { readManifest } from "./manifest"
import { exec } from "./Process"
import { ProcessError } from "./ProcessError"
import { Timer } from "./Timer"
import Path from "path"

export interface ExecutionSummary {
  workspace: Workspace
  command: string
  succeeded: boolean
  output: string
  duration: number
}

function binPath(base: string) {
  return Path.join(base, "node_modules", ".bin")
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
    throw new Error(`no script "${script}" found`)
  }
  // stdout.writeLine(chalk.blue(workspace.name + ":") + " " + [command, ...args].join(" "))
  const timer = Timer()
  try {
    const output = await exec([command, ...args].join(" "), {
      cwd: workspace.path,
      env: { ...process.env, PATH: [binPath(workspace.path), binPath(process.cwd()), process.env.PATH].join(":") }
    }).promise()
    const duration = timer()
    return {
      workspace,
      command: [command, ...args].join(" "),
      output: output.toString("utf-8"),
      succeeded: true,
      duration
    }
  } catch (err) {
    if (err instanceof ProcessError) {
      return {
        workspace,
        command: [command, ...args].join(" "),
        succeeded: false,
        duration: timer(),
        output: err.output
      }
    } else {
      throw err
    }
  }
}
