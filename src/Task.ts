import { debug } from "./output";
import { AsyncQueue, AsyncManualResetEvent, AsyncCountdownEvent } from "@esfx/async";
import { AsyncDisposable } from "@esfx/disposable";

export interface Task {
  (): Promise<void>
}

export class Executor implements AsyncDisposable {
  private running = true
  private status = new AsyncManualResetEvent(true)

  constructor(private id: string, private queue: AsyncQueue<Task>) {
    this.run()
  }

  async run() {
    debug(`${this.id}: online`)
    while (this.running) {
      debug(`${this.id}: awaiting work`)
      const task = await this.queue.get()
      this.status.reset()
      await task()
      this.status.set()
    }
  }

  async [AsyncDisposable.asyncDispose]() {
    this.running = false
    await this.status.wait()
  }
}