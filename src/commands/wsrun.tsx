import { AsyncCountdownEvent, CancelError, CancelToken } from "@esfx/async";
import { Command, flags as CommandFlags } from "@oclif/command";
import * as Errors from "@oclif/errors";
import * as F from "fluture";
import { attempt, FutureInstance as Future } from "fluture";
import * as Ink from "ink";
import { cpus } from "os";
import React from "react";
import { AsyncExecutor } from "../Executor";
import { partition } from "../graph";
import { runScript } from "../runner";
import { FailureTaskState, State, SuccessTaskState, TaskState } from "../TaskState";
import { Timer } from "../Timer";
import { Reporter } from "../ui/Reporter";
import { SuccessSummary } from "../ui/SuccessSummary";
import * as Yarn from "../yarn";

const WORKER_COUNT = cpus().length - 1

interface RunScriptTask {
  script: string
  workspace: Workspace
  args: Array<string>
}

function mkRunScriptTask(task: RunScriptTask): Future<Error, SuccessTaskState | FailureTaskState> {
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
    const tasks: Map<string, TaskState> = new Map()
    const { script } = args
    const barrier = new AsyncCountdownEvent(0)

    for (const workspace of workspaces) {
      tasks.set(workspace.name, { state: State.Pending, workspace })
    }

    const mkUI = () => (
      <Reporter timer={timer} tasks={Array.from(tasks.values())} showSummary={!hasFailures()} />
    )
    const ui = Ink.render(mkUI())
    const render = (content = mkUI()) => ui.rerender(content)

    function hasFailures() {
      return Array.from(tasks.values()).some(task => task.state === State.Failure)
    }

    const supervisor = CancelToken.source()
    const executor = new AsyncExecutor(WORKER_COUNT, supervisor)

    function updateState(workspace: Workspace, state: TaskState): void {
      tasks.delete(workspace.name)
      tasks.set(workspace.name, state)
      render()
    }

    function onStarted(workspace: Workspace) {
      return function <L, R>(future: Future<L, R>): Future<L, R> {
        return attempt<L, void>(() => {
          const timer = Timer()
          updateState(workspace, {
            state: State.Running,
            workspace,
            timer
          })
        }).and(future)
      }
    }

    function onSuccess(state: SuccessTaskState | FailureTaskState) {
      if (state.state === State.Failure) {
        supervisor.cancel()
      }
      updateState(state.workspace, state)
      barrier.signal()
    }

    function onFailure(task: RunScriptTask, error: Error) {
      barrier.signal()
      if (!(error instanceof CancelError)) {
        updateState(task.workspace, {
          state: State.Failure,
          workspace: task.workspace,
          duration: 0,
          output: error.message
        })
        supervisor.cancel()
      } else {
        updateState(task.workspace, {
          state: State.Aborted,
          workspace: task.workspace
        })
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
            const status = await executor.schedule(mkRunScriptTask(task).pipe(onStarted(workspace)))
            onSuccess(status)
          } catch (error) {
            onFailure(task, error)
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
