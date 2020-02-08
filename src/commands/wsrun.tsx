import { cpus } from "os"
import { CancelError, CancelToken, AsyncCountdownEvent } from "@esfx/async"
import { Command, flags as CommandFlags } from "@oclif/command"
import * as Errors from "@oclif/errors"
import * as F from "fluture"
import { attempt, FutureInstance as Future } from "fluture"
import * as Ink from "ink"
import storage from "node-persist"
import React from "react"
import { AsyncExecutor } from "../Executor"
import { FailureTaskState, State, SuccessTaskState, TaskState } from "../TaskState"
import { Timer } from "../Timer"
import { partition } from "../graph"
import { runScript } from "../runner"
import { Reporter } from "../ui/Reporter"
import { SuccessSummary } from "../ui/SuccessSummary"
import { calculateAveragesPerWorkspace, sort, sortGroupByAverageTimeDesc } from "../utils"
import * as Yarn from "../yarn"

/**
 * When you have a low amount of CPU cores, you want to have multiple threads per core if it is supported.
 *
 * When the core count gets higher the benefit or running multiple threads on the same core goes down,
 * since it lowers the boost clock and hinders the performance of each thread.
 *
 * So when the core count gets higher, you want to run only on the physical cores.
 *
 * This is a naive function that determines the worker count based on the "cpus" available.
 * The length of cpus is actually the number of threads the CPU can run.
 */
function getWorkerCount(maximumParallelism: boolean, threads?: number) {
  if (threads && Number.isInteger(threads)) {
    return threads
  }
  const threadCount = cpus().length
  if (maximumParallelism) {
    return threadCount - 1
  }
  return threadCount / 2
}

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
    help: CommandFlags.help(),
    learn: CommandFlags.boolean({
      char: "l",
      default: false,
      description: "Teach the tool to optimize building order"
    }),
    maximumParallelism: CommandFlags.boolean({
      char: "p",
      default: false,
      description:
        "Maximize parallel build count. Depends on the CPU if this is a good option or not, you should test if it makes your build faster."
    }),
    threadCount: CommandFlags.integer({
      char: "t",
      default: undefined,
      description:
        "Amount of threads to use for task running. Maximum amount of parallel tasks that can run."
    }),
    alternateOrder: CommandFlags.boolean({
      char: "o",
      default: false,
      description:
        "By default non-blocking workspaces are build fastest first while there are still blocking workspaces left. This alters the order to be slowest first."
    })
  }

  async run() {
    const timer = Timer()
    const { args, flags } = this.parse(WsrunCommand)
    const WORKER_COUNT = getWorkerCount(flags.maximumParallelism, flags.threadCount)
    const workspaces = await Yarn.findWorkspaces(process.cwd())
    const groups = flags.unordered
      ? [[new Set(workspaces), new Set<Workspace>()]]
      : partition(workspaces, ws => ws.dependencies)
    const totalTasks = workspaces.length
    const tasks: Map<string, TaskState> = new Map()
    const { script } = args
    const jobBarrier = new AsyncCountdownEvent(workspaces.length)
    const groupBarrier = new AsyncCountdownEvent(0)
    await storage.init()
    const averageTimePerWorkspace = await calculateAveragesPerWorkspace(workspaces, storage, script)

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
      return function<L, R>(future: Future<L, R>): Future<L, R> {
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

    async function onSuccess(state: SuccessTaskState | FailureTaskState, primary = true) {
      if (state.state === State.Failure) {
        supervisor.cancel()
      }
      if (flags.learn) {
        const times: number[] = (await storage.get(script + state.workspace.name)) || []
        await storage.set(script + state.workspace.name, [
          // Filter out builds that hang for various reasons i.e. closing the laptop lid
          ...times.filter(t => t < 1000 * 60 * 10),
          state.duration
        ])
      }
      updateState(state.workspace, state)
      jobBarrier.signal()
      if (primary) {
        groupBarrier.signal()
      }
    }

    function onFailure(task: RunScriptTask, error: Error) {
      jobBarrier.signal()
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

    async function runTask(workspace: Workspace, primary = true) {
      const task: RunScriptTask = { workspace, script, args: [] }
      try {
        const status = await executor.schedule(mkRunScriptTask(task).pipe(onStarted(workspace)))
        onSuccess(status, primary)
      } catch (error) {
        onFailure(task, error)
      }
    }

    let unprocessedLeaves = new Array<Workspace>()
    function sortWorkgroups(group: Set<Workspace>, leaves: Set<Workspace>, lastLoop: boolean) {
      if (lastLoop) {
        unprocessedLeaves = []
        const combinedWorkgroups = Array(...leaves)
          .concat(Array(...group))
          .concat(unprocessedLeaves)
        return sort(combinedWorkgroups, averageTimePerWorkspace)
      }
      const combinedLeaves = Array(...leaves).concat(unprocessedLeaves)
      unprocessedLeaves = sort(combinedLeaves, averageTimePerWorkspace, flags.alternateOrder)
      return sortGroupByAverageTimeDesc(group, averageTimePerWorkspace)
    }

    // We want to handle slowest blocking workspaces first, and while we wait
    // we want to handle fastest non-blocking workspaces. When we have processed
    // all the blocking workspaces, we want to handle all remaining non-blocking
    // workspaces slowest first
    for (let i = 0; i < groups.length; i++) {
      if (supervisor.token.signaled) {
        // barrier.reset(0)
        break
      }
      const [group, leaves] = groups[i]
      const lastLoop = i + 1 === groups.length
      const sortedGroup = sortWorkgroups(group, leaves, lastLoop)
      groupBarrier.reset(sortedGroup.length)
      for (const workspace of sortedGroup) {
        runTask(workspace)
      }
      while (groupBarrier.remainingCount > 0 && unprocessedLeaves.length > 0) {
        await executor.wait()
        // Always give group workspaces precedence
        if (groupBarrier.remainingCount > 0) {
          const workspace = unprocessedLeaves.shift()!
          runTask(workspace, false)
        }
      }
      await groupBarrier.wait()
    }
    await jobBarrier.wait()

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
