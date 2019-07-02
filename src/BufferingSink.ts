import { Writable } from "stream";
import { Deferred } from "@esfx/async";

export class BufferingSink extends Writable {
  private chunks: Array<Buffer> = []

  constructor() {
    super({ highWaterMark: Number.MAX_VALUE })
  }

  _write(chunk: string | Buffer, encoding: BufferEncoding, done: (error?: Error) => void) {
    process.nextTick(() => {
      try {
        if (Buffer.isBuffer(chunk)) {
          this.chunks.push(chunk)
        } else {
          this.chunks.push(Buffer.from(chunk, encoding))
        }
        done()
      } catch (error) {
        done(error)
      }
    })
  }

  async buffered(): Promise<Buffer> {
    if (this.writable) {
      const deferred = new Deferred<void>()
      this.end(() => deferred.resolve())
      await deferred.promise
      return this.data
    } else {
      return this.data
    }
  }

  private get data(): Buffer {
    if (this.writable) {
      throw new Error("cannot extract data from stream still in use")
    }
    return Buffer.concat(this.chunks)
  }
}