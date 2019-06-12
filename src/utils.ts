import assert from "assert"

export function* range(from: number, to: number) {
  assert(from <= to, "from <= to")
  while (from <= to) {
    yield from
    from++
  }
}

export function repeat(n: number, fn: (i: number) => void) {
  for (const i of range(0, n - 1)) {
    fn(i)
  }
}