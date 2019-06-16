import { AsyncManualResetEvent, AsyncQueue } from "@esfx/async"
import { AsyncDisposable } from "@esfx/disposable"
import { debug } from "./output"

export interface Task<T> {
  (): Promise<T>
}

export class Executor<T> implements AsyncDisposable {
  private running = true
  private status = new AsyncManualResetEvent(true)

  constructor(
    private id: string,
    private queue: AsyncQueue<Task<T>>,
    private onTaskComplete: (result: T) => void
  ) {
    this.run()
  }

  async run() {
    debug(`${this.id}: online`)
    while (this.running) {
      debug(`${this.id}: awaiting work`)
      const task = await this.queue.get()
      this.status.reset()
      const result = await task()
      this.status.set()
      this.onTaskComplete(result)
    }
  }

  async [AsyncDisposable.asyncDispose]() {
    this.running = false
    await this.status.wait()
  }
}
