import { AsyncCountdownEvent, CancelError, CancelToken } from "@esfx/async"
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
import { Reporter } from "../ui/Reporter"
import { SuccessSummary } from "../ui/SuccessSummary"
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
    const groups = flags.unordered
      ? [new Set(workspaces)]
      : partition(workspaces, ws => ws.dependencies)
    const totalTasks = workspaces.length
    const finishedTasks: Array<ExecutionSummary> = []
    const { script } = args
    const barrier = new AsyncCountdownEvent(0)

    const mkUI = () => (
      <Reporter
        timer={timer}
        finishedTasks={finishedTasks}
        totalTasks={totalTasks}
        showSummary={!hasFailures()}
      />
    )
    const ui = Ink.render(mkUI())
    const render = (content = mkUI()) => ui.rerender(content)

    function hasFailures() {
      return finishedTasks.some(summary => !summary.succeeded)
    }

    const supervisor = CancelToken.source()
    const executor = new AsyncExecutor(WORKER_COUNT, supervisor)

    function onSuccess(summary: ExecutionSummary) {
      if (!summary.succeeded) {
        supervisor.cancel()
      }
      finishedTasks.push(summary)
      barrier.signal()
    }

    function onFailure(task: RunScriptTask, error: Error) {
      barrier.signal()
      if (!(error instanceof CancelError)) {
        finishedTasks.push({
          command: task.script,
          workspace: task.workspace,
          duration: 0,
          output: error.message,
          succeeded: false
        })
        supervisor.cancel()
      }
    }

    for (const group of groups) {
      if (supervisor.token.signaled) {
        break
      }
      barrier.reset(group.size)
      for (const workspace of group) {
        const task: RunScriptTask = { workspace, script, args: [] }
        process.nextTick(async () => {
          try {
            const summary = await executor.schedule(mkRunScriptTask(task))
            onSuccess(summary)
          } catch (error) {
            onFailure(task, error)
          } finally {
            render()
          }
        })
      }
      await barrier.wait()
    }

    if (!hasFailures()) {
      render(<SuccessSummary elapsedTime={timer()} taskCount={totalTasks} />)
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
