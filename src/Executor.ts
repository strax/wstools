import { AsyncSemaphore, CancelSource, CancelToken } from "@esfx/async"
import { Cancelable, CancelSignal, CancelError } from "@esfx/cancelable"
import { FutureInstance as Future, attempt } from "fluture"

export class AsyncExecutor implements Cancelable {
  private semaphore: AsyncSemaphore

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
      const cancel = task.finally(attempt(() => this.semaphore.release())).fork(reject, resolve)
      CancelToken.from(this).subscribe(() => {
        cancel()
        reject(new CancelError("Operation was cancelled"))
      })
    })
  }

  [Cancelable.cancelSignal](): CancelSignal {
    return CancelToken.from(this.cancelToken)
  }
}
