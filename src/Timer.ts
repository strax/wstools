export type Timer = () => number

export function Timer(): Timer {
  const start = Date.now()
  return function end() {
    return Date.now() - start
  }
}
