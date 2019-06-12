import { Deferred } from "@esfx/async"
import chalk from "chalk"
import { exec as execA, ExecOptions, spawn } from "child_process"
import { readManifest } from "./manifest"
import { ProcessError } from "./ProcessError"
import { error, stdout } from "./output"

async function exec(command: string, opts: ExecOptions = {}): Promise<string> {
  const deferred = new Deferred<string>()
  execA(command, opts, (err, stdout, stderr) => {
    if (err) {
      process.stderr.write(stderr)
      if (err.code) {
        deferred.reject(new ProcessError(`Process exited with status code ${err.code}`, err.code))
      } else {
        deferred.reject(err)
      }
    } else {
      deferred.resolve(stdout.toString())
    }
  })
  return deferred.promise
}

export async function runCommand(workspace: Workspace, command: Array<string>) {
  return new Promise((resolve, reject) => {
    console.log(chalk.blue(workspace.name + ":"), command.join(" "))
    const [program, ...args] = command
    const proc = spawn(program, args, {
      stdio: "inherit",
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

export async function runScript(workspace: Workspace, script: string, args: Array<string> = []) {
  const manifest = await readManifest(workspace.path)
  if (!manifest.scripts) {
    throw new Error(`no "scripts" field in package.json`)
  }
  const command = manifest.scripts[script]
  if (!command) {
    throw new Error(`no script named "${script} found`)
  }
  // stdout.writeLine(chalk.blue(workspace.name + ":") + " " + [command, ...args].join(" "))
  try {
    return await exec([command, ...args].join(" "), { cwd: workspace.path, env: process.env })
  } catch (err) {
    error(workspace.name + ": " + err.toString())
  }
}
