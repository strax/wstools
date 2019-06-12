import { AsyncDisposable } from "@esfx/disposable";
import { debug } from "./output";
import { repeat } from "./utils";
import { Executor, Task } from "./Task";
import { AsyncQueue } from "@esfx/async";
import OS from "os"

export class ExecutorGroup implements AsyncDisposable {
  private executors = new Set<Executor>()
  private queue = new AsyncQueue<Task>()

  static autosized(id = "default"): ExecutorGroup {
    return new ExecutorGroup(id, OS.cpus().length - 1)
  }

  constructor(private id: string, private size: number) {
    debug(`${this.id}: creating ${size} executors`)
    repeat(size, i => this.executors.add(new Executor(`${this.id}-${i}`, this.queue)))
  }

  schedule(task: Task) {
    this.queue.put(task)
  }

  async [AsyncDisposable.asyncDispose]() {
    debug(`${this.id}: disposing resources...`)
    await Promise.all(Array.from(this.executors).map(resource => resource[AsyncDisposable.asyncDispose]()))
  }
}