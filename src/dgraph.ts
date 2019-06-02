export function dfs<V>(vertices: Iterable<V>, edges: (vertex: V) => Iterable<V>, cb: (vertex: V) => void) {
  const visited = new Set<V>()

  function visit(node: V) {
    visited.add(node)
    for (const adjacent of edges(node)) {
      if (!visited.has(adjacent)) {
        visit(adjacent)
      }
    }
    cb(node)
  }

  for (const vertex of vertices) {
    if (!visited.has(vertex)) {
      visit(vertex)
    }
  }
}

export function toposort<T>(vertices: Array<T>, adjacent: (vertex: T) => Iterable<T>): Iterable<T> {
  const queue: Array<T> = []
  dfs(vertices, adjacent, p => queue.push(p))
  return queue
}

export function series<T>(vertices: Array<T>, edges: (vertex: T) => Iterable<T>): Iterable<Set<T>> {
  const remaining = new Set<T>(vertices)
  const series: Array<Set<T>> = []

  function constraint(v: T) {
    for (const u of edges(v)) {
      if (remaining.has(u)) {
        return false
      }
    }
    return true
  }

  while (remaining.size > 0) {
    const group = new Set<T>()
    for (const v of remaining) {
      if (constraint(v)) {
        group.add(v)
      }
    }
    for (const v of group) {
      remaining.delete(v)
    }
    series.push(group)
  }
  return series
}
