import { AsyncCountdownEvent, CancelToken, CancelError } from "@esfx/async"
import { Command, flags as CommandFlags } from "@oclif/command"
import * as Errors from "@oclif/errors"
import * as F from "fluture"
import { FutureInstance as Future } from "fluture"
import * as Ink from "ink"
import { cpus } from "os"
import React from "react"
import { AsyncExecutor } from "../Executor"
import { partition } from "../graph"
import { ExecutionSummary, runScript } from "../runner"
import { Timer } from "../Timer"
import { FailureSummary } from "../ui/FailureSummary"
import { SuccessSummary } from "../ui/SuccessSummary"
import { UI } from "../ui/UI"
import * as Yarn from "../yarn"

const WORKER_COUNT = cpus().length

interface RunScriptTask {
  script: string
  workspace: Workspace
  args: Array<string>
}

function mkRunScriptTask(task: RunScriptTask): Future<Error, ExecutionSummary> {
  return F.tryP(async () => {
    return await runScript(task.workspace, task.script, task.args)
  })
}

class WsrunCommand extends Command {
  static args = [
    {
      name: "script" as const,
      required: true,
      description: "The package.json script to run in each workspace"
    }
  ]

  static flags = {
    unordered: CommandFlags.boolean({
      char: "u",
      default: false,
      description: "Execute workspaces in parallel without generating a dependency graph"
    }),
    help: CommandFlags.help()
  }

  async run() {
    const timer = Timer()
    const { args, flags } = this.parse(WsrunCommand)
    const workspaces = await Yarn.findWorkspaces(process.cwd())
    const groups = flags.unordered ? [new Set(workspaces)] : partition(workspaces, ws => ws.dependencies)
    const totalTasks = workspaces.length
    const finishedTasks: Array<ExecutionSummary> = []
    const runningTasks: Set<string> = new Set()
    const { script } = args
    const barrier = new AsyncCountdownEvent(0)

    const mkUI = () => (
      <UI
        timer={timer}
        finishedTasks={finishedTasks}
        runningTasks={runningTasks}
        totalTasks={totalTasks}
      />
    )
    const ui = Ink.render(mkUI())
    const render = (content = mkUI()) => ui.rerender(content)

    function hasFailures() {
      return finishedTasks.some(summary => !summary.succeeded)
    }

    const execution = CancelToken.source()
    const executor = new AsyncExecutor(WORKER_COUNT, execution)

    function onSuccess(summary: ExecutionSummary) {
      runningTasks.delete(summary.workspace.name)
      finishedTasks.push(summary)
      barrier.signal()
    }

    function onFailure(task: RunScriptTask, error: Error) {
      runningTasks.delete(task.workspace.name)
      barrier.signal()
      if (error instanceof CancelError) {
        return
      }
      const summary = {
        command: task.script,
        workspace: task.workspace,
        duration: 0,
        output: error.message,
        succeeded: false
      }
      finishedTasks.push(summary)
      execution.cancel()
    }

    for (const group of groups) {
      if (execution.token.signaled) {
        break
      }
      barrier.reset(group.size)
      for (const workspace of group) {
        const task: RunScriptTask = { workspace, script, args: [] }
        executor
          .schedule(mkRunScriptTask(task))
          .then(onSuccess, error => onFailure(task, error))
          .finally(() => render())
        runningTasks.add(workspace.name)
      }
      await barrier.wait()
    }

    if (!hasFailures()) {
      render(<SuccessSummary elapsedTime={timer()} taskCount={totalTasks} />)
    } else {
      render(<FailureSummary failure={finishedTasks.find(_ => !_.succeeded)!} />)
    }
    ui.unmount()
    await ui.waitUntilExit()
    if (hasFailures()) {
      this.exit(1)
    } else {
      this.exit(0)
    }
  }
}

Promise.resolve(WsrunCommand.run()).catch(Errors.handle)
