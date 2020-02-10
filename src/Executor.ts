import { AsyncSemaphore, CancelSource, CancelToken } from "@esfx/async"
import { Cancelable, CancelSignal, CancelError } from "@esfx/cancelable"
import { FutureInstance as Future, attempt } from "fluture"

export class AsyncExecutor implements Cancelable {
  // The semaphore handles the work queue and the amount of running tasks
  private semaphore: AsyncSemaphore
  // Waiters allows having async waiters outside the executor that
  // check if a task should be queued or not
  private waiters: Array<(value?: unknown) => void> = []

  constructor(capacity: number, private cancelToken: CancelSource) {
    this.semaphore = new AsyncSemaphore(capacity)
  }

  async schedule<L, R>(task: Future<L, R>) {
    return new Promise<R>(async (resolve, reject) => {
      try {
        await this.semaphore.wait(this)
      } catch (err) {
        reject(err)
      }
      const cancel = task
        .finally(
          attempt(() => {
            this.semaphore.release()
            this.resolveWaiter()
          })
        )
        .fork(reject, resolve)
      CancelToken.from(this).subscribe(() => {
        cancel()
        reject(new CancelError("Operation was cancelled"))
      })
    })
  }

  get isFull() {
    return this.semaphore.count === 0
  }

  /**
   * If executor isn't full, inform the waiter.
   * If full, add to the waiter queue
   */
  private resolveOrWait(res: (value?: unknown) => void): void {
    if (this.isFull) {
      this.waiters.push(res)
    } else {
      res()
    }
  }
  /**
   * If executor has free space, inform the waiter
   */
  private resolveWaiter(): void {
    if (!this.isFull) {
      const res = this.waiters.shift()
      if (res) {
        res()
      }
    }
  }

  /**
   * Wait for the executor to have free space for a new task
   */
  async wait() {
    return new Promise(res => {
      this.resolveOrWait(res)
    })
  }

  [Cancelable.cancelSignal](): CancelSignal {
    return CancelToken.from(this.cancelToken)
  }
}
