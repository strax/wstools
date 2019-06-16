import { AsyncQueue, Deferred } from "@esfx/async"
import { AsyncDisposable } from "@esfx/disposable"
import OS from "os"
import { debug } from "./output"
import { Executor, Task } from "./Task"
import { repeat } from "./utils"

export class ExecutorGroup<T> implements AsyncDisposable {
  private executors = new Set<Executor<T>>()
  private queue = new AsyncQueue<Task<T>>()

  static autosized<T>(onTaskComplete: (result: T) => void): ExecutorGroup<T> {
    return new ExecutorGroup("autosized", OS.cpus().length - 1, onTaskComplete)
  }

  constructor(private id: string, private size: number, onTaskComplete: (result: T) => void) {
    debug(`${this.id}: creating ${size} executors`)
    repeat(size, i =>
      this.executors.add(new Executor(`${this.id}-${i}`, this.queue, onTaskComplete))
    )
  }

  schedule(task: Task<T>): Promise<void> {
    const started = new Deferred<void>()
    this.queue.put(() => {
      started.resolve()
      return task()
    })
    return started.promise
  }

  async [AsyncDisposable.asyncDispose]() {
    debug(`${this.id}: disposing resources...`)
    await Promise.all(
      Array.from(this.executors).map(resource => resource[AsyncDisposable.asyncDispose]())
    )
  }
}
