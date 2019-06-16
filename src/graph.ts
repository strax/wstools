export function dfs<V>(
  vertices: Iterable<V>,
  edges: (vertex: V) => Iterable<V>,
  cb: (vertex: V) => void
) {
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

// Standard topological sort
export function toposort<T>(vertices: Array<T>, adjacent: (vertex: T) => Iterable<T>): Iterable<T> {
  const queue: Array<T> = []
  dfs(vertices, adjacent, p => queue.push(p))
  return queue
}

// Naive graph partitioning into nodes that can be executed in parallel
// This algorithm is O(V * E) but works fast enough since there typically aren't over a hunder workspaces
export function partition<T>(
  vertices: Array<T>,
  edges: (vertex: T) => Iterable<T>
): Iterable<Set<T>> {
  const remaining = new Set<T>(vertices)
  const series: Array<Set<T>> = []

  function satisfied(v: T) {
    for (const u of edges(v)) {
      if (remaining.has(u)) {
        return false
      }
    }
    return true
  }

  function indeg(v: T): number {
    return vertices.filter(u => Array.from(edges(u)).includes(v)).length
  }

  // TODO: Detect cycles, otherwise we'll loop forever
  const leaves = new Set<T>()
  while (remaining.size > 0) {
    const group = new Set<T>()
    for (const v of remaining) {
      if (satisfied(v) && indeg(v) > 0) {
        group.add(v)
      } else if (satisfied(v)) {
        leaves.add(v)
        remaining.delete(v)
      }
    }
    for (const v of group) {
      remaining.delete(v)
    }
    series.push(group)
  }
  series.push(leaves)
  return series
}
