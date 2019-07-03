import { readManifest } from "./manifest"
import { exec } from "./Process"
import { ProcessError } from "./ProcessError"
import { Timer } from "./Timer"
import Path from "path"
import { BufferingSink } from "./BufferingSink";
import { SuccessTaskState, FailureTaskState, State } from "./TaskState";

function binPath(base: string) {
  return Path.join(base, "node_modules", ".bin")
}

async function hasScript(workspace: Workspace, script: string) {
  const manifest = await readManifest(workspace.path)
  return !!manifest.scripts && !!manifest.scripts[script]
}

export async function runScript(
  workspace: Workspace,
  script: string,
  args: Array<string> = []
): Promise<SuccessTaskState | FailureTaskState> {
  const manifest = await readManifest(workspace.path)
  if (!(await hasScript(workspace, script))) {
    throw new Error(`no script "${script}" found`)
  }
  const command = manifest.scripts![script]
  // stdout.writeLine(chalk.blue(workspace.name + ":") + " " + [command, ...args].join(" "))
  const timer = Timer()

  const output = new BufferingSink()
  async function exec1(command: string) {
    return await exec(command, {
      cwd: workspace.path,
      output,
      env: { ...process.env, PATH: [binPath(workspace.path), binPath(process.cwd()), process.env.PATH].join(":") }
    }).promise()
  }

  try {
    const prehook = `pre${script}`
    if (await hasScript(workspace, prehook)) {
      await exec1(manifest.scripts![prehook])
    }

    await exec1([command, ...args].join(" "))

    const posthook = `post${script}`
    if (await hasScript(workspace, posthook)) {
      await exec1(manifest.scripts![posthook])
    }

    const duration = timer()
    return {
      state: State.Success,
      workspace,
      output: (await output.buffered()).toString("utf-8"),
      duration
    }
  } catch (err) {
    if (err instanceof ProcessError) {
      return {
        state: State.Failure,
        workspace,
        duration: timer(),
        output: (await output.buffered()).toString("utf-8")
      }
    } else {
      throw err
    }
  }
}
