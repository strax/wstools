import { AsyncCountdownEvent, AsyncManualResetEvent, AsyncQueue } from "@esfx/async"
import { AsyncDisposable } from "@esfx/disposable"
import * as OS from "os"
import { series } from "../dgraph"
import { runScript } from "../runner"
import { Timer } from "../Timer"
import { debug, info } from "../output"
import * as Yarn from "../yarn"

interface RunScriptTask {
  workspace: Workspace
  script: string
}

abstract class Worker<T> implements AsyncDisposable {
  private acceptNewTasks = true
  private status = new AsyncManualResetEvent(true)

  constructor(private id: string, private tasks: AsyncQueue<T>, private onTaskFinished: AsyncCountdownEvent) {
    this.run()
  }

  abstract execute(task: T): Promise<void>

  async run() {
    while (this.acceptNewTasks) {
      debug(`${this.id}: accept work`)
      const task = await this.tasks.get()
      this.status.reset()
      await this.execute(task)
      this.onTaskFinished.signal()
      this.status.set()
    }
  }

  [AsyncDisposable.asyncDispose]() {
    this.acceptNewTasks = false
    return this.status.wait()
  }
}

interface RunScriptTask {
  script: string
  workspace: Workspace
  args: Array<string>
}

class RunScriptWorker extends Worker<RunScriptTask> {
  async execute(task: RunScriptTask): Promise<void> {
    debug(`execute: ${task.workspace.name}`)
    const time = Timer()
    await runScript(task.workspace, task.script, task.args)
    debug(`execute: ${task.workspace.name} finished in ${time()}ms`)
  }
}

class AsyncResourcePool<T extends AsyncDisposable> implements AsyncDisposable {
  private resources = new Set<T>()

  constructor(private id: string, private create: (i: number) => T) {}

  start(size: number) {
    debug(`${this.id}: pool size: ${size}`)
    for (let i = 0; i < size; i++) {
      this.resources.add(this.create(i))
    }
  }

  async [AsyncDisposable.asyncDispose]() {
    debug(`${this.id}: disposing resources...`)
    await Promise.all(Array.from(this.resources).map(resource => resource[AsyncDisposable.asyncDispose]()))
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
  // let error = null
  const groups = series(workspaces, ws => ws.dependencies)
  const queue = new AsyncQueue<RunScriptTask>()
  const barrier = new AsyncCountdownEvent(0)
  const workers = new AsyncResourcePool("pool0", i => new RunScriptWorker(`worker${i}`, queue, barrier))
  workers.start(OS.cpus().length - 1)

  for (const [i, group] of indexed(groups)) {
    info(`#${i}: start`)
    barrier.reset(group.size)
    for (const workspace of group) {
      info(`#${i}: ${workspace.name}`)
      queue.put({ workspace, script, args })
    }
    await barrier.wait()
    info(`#${i}: end`)
  }

  debug(`total time elapsed: ${time()}ms`)
}

main()
