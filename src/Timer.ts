export function Timer() {
  const start = Date.now()
  return function end() {
    return Date.now() - start
  }
}
