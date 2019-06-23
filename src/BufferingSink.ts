import { Writable } from "stream";

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

  intoBuffer(): Buffer {
    return Buffer.concat(this.chunks)
  }
}