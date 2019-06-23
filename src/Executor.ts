import { AsyncSemaphore, CancelSource, CancelToken } from "@esfx/async"
import { Cancelable, CancelSignal, CancelError } from "@esfx/cancelable"
import { FutureInstance as Future } from "fluture"

export class AsyncExecutor implements Cancelable {
  private semaphore: AsyncSemaphore

  constructor(capacity: number, private cancelToken: CancelSource) {
    this.semaphore = new AsyncSemaphore(capacity)
  }

  async schedule<L, R>(task: Future<L, R>) {
    return new Promise<R>(async (resolve, reject) => {
      try {
        await this.semaphore.wait(this)
        const cancel = task.fork(reject, resolve)
        CancelToken.from(this).subscribe(() => {
          cancel()
          reject(new CancelError("Operation was cancelled"))
        })
      } finally {
        this.semaphore.release()
      }
    })
  }

  [Cancelable.cancelSignal](): CancelSignal {
    return CancelToken.from(this.cancelToken)
  }
}
