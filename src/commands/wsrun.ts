import { AsyncCountdownEvent, AsyncManualResetEvent, AsyncQueue } from "@esfx/async"
import { AsyncDisposable } from "@esfx/disposable"
import * as OS from "os"
import { partition } from "../graph"
import { runScript } from "../runner"
import { Timer } from "../Timer"
import { debug, info, stderr } from "../output"
import * as Yarn from "../yarn"
import { Task } from "../Task";
import { ExecutorGroup } from "../AsyncResourcePool";

interface RunScriptTask {
  workspace: Workspace
  script: string
}

interface RunScriptTask {
  script: string
  workspace: Workspace
  args: Array<string>
}

function mkRunScriptTask(task: RunScriptTask, countdownEvent: AsyncCountdownEvent): Task {
  return async function () {
    const time = Timer()
    await runScript(task.workspace, task.script, task.args)
    countdownEvent.signal()
    debug(`${task.workspace.name} finished in ${time()}ms`)
  }
}

function* indexed<A>(as: Iterable<A>): Iterable<[number, A]> {
  let i = 0
  for (const a of as) {
    yield [i, a]
    i++
  }
}

async function main() {
  const time = Timer()
  const [script, ...args] = process.argv.slice(2)
  if (!script) {
    console.error("usage: wsrun <script>")
    return process.exit(1)
  }
  const workspaces = await Yarn.findWorkspaces(process.cwd())
  const groups = partition(workspaces, ws => ws.dependencies)
  const barrier = new AsyncCountdownEvent(0)
  const executor = ExecutorGroup.autosized()

  for (const [i, group] of indexed(groups)) {
    info(`#${i}: running ${group.size} tasks`)
    const timer = Timer()
    barrier.reset(group.size)
    for (const workspace of group) {
      info(`#${i}: [${workspace.name}] ${script} ${args.join(" ")}`)
      executor.schedule(mkRunScriptTask({ workspace, script, args }, barrier))
    }
    await barrier.wait()
    info(`#${i}: done in ${timer()}ms`)
    stderr.writeLine("")
  }

  debug(`total time elapsed: ${time()}ms`)
}

main()
