import { AsyncCountdownEvent } from "@esfx/async"
import * as Ink from "ink"
import React from "react"
import { ExecutorGroup } from "../AsyncResourcePool"
import { partition } from "../graph"
import { ExecutionSummary, runScript } from "../runner"
import { Task } from "../Task"
import { Timer } from "../Timer"
import { FailureSummary } from "../ui/FailureSummary"
import { SuccessSummary } from "../ui/SuccessSummary"
import { UI } from "../ui/UI"
import { indexed } from "../utils"
import * as Yarn from "../yarn"

interface RunScriptTask {
  script: string
  workspace: Workspace
  args: Array<string>
}

function mkRunScriptTask(
  task: RunScriptTask,
  countdownEvent: AsyncCountdownEvent
): Task<ExecutionSummary> {
  return async function() {
    try {
      return await runScript(task.workspace, task.script, task.args)
    } finally {
      countdownEvent.signal()
    }
  }
}

async function main() {
  const timer = Timer()
  const [script, ...args] = process.argv.slice(2)
  if (!script) {
    console.error("usage: wsrun <script>")
    return process.exit(1)
  }
  const workspaces = await Yarn.findWorkspaces(process.cwd())
  const groups = partition(workspaces, ws => ws.dependencies)
  const totalTasks = workspaces.length
  const barrier = new AsyncCountdownEvent(0)
  const finishedTasks: Array<ExecutionSummary> = []
  const runningTasks: Set<string> = new Set()

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

  let firstFailure: ExecutionSummary | undefined = undefined
  const executor = ExecutorGroup.autosized<ExecutionSummary>(summary => {
    runningTasks.delete(summary.workspace)
    finishedTasks.push(summary)
    if (!summary.succeeded) {
      firstFailure = summary
    }
    render()
  })

  for (const [i, group] of indexed(groups)) {
    if (firstFailure) break
    barrier.reset(group.size)
    for (const workspace of group) {
      executor.schedule(mkRunScriptTask({ workspace, script, args }, barrier)).then(() => {
        runningTasks.add(workspace.name)
        render()
      })
    }
    await barrier.wait()
  }

  if (!firstFailure) {
    render(<SuccessSummary elapsedTime={timer()} taskCount={totalTasks} />)
  } else {
    render(<FailureSummary failure={firstFailure!} />)
  }
  ui.unmount()
  await ui.waitUntilExit()
  if (firstFailure) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

main()
