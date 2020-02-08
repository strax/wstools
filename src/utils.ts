import assert from "assert"
import { LocalStorage } from "node-persist"

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

export async function calculateAveragesPerWorkspace(
  workspaces: Workspace[],
  storage: LocalStorage,
  script: string
) {
  const averages = await Promise.all(
    workspaces.map(async workspace => {
      const times: number[] = (await storage.get(script + workspace.name)) || []
      const average = times.reduce((sum, time) => sum + time, 0) / times.length
      return {
        workspace: workspace.name,
        average
      }
    })
  )
  const averageTimePerWorkspace = averages.reduce<{
    [key: string]: number
  }>((acc, average) => {
    return {
      ...acc,
      [average.workspace]: average.average
    }
  }, {})
  return averageTimePerWorkspace
}

export function sort(
  sortable: Array<Workspace>,
  averageTimePerWorkspace: { [key: string]: number },
  desc = true
) {
  return sortable.sort((a, b) => {
    const aAverage = averageTimePerWorkspace[a.name]
    const bAverage = averageTimePerWorkspace[b.name]
    return desc ? bAverage - aAverage : aAverage - bAverage
  })
}

export function sortGroupByAverageTime(
  group: Set<Workspace>,
  averageTimePerWorkspace: { [key: string]: number },
  desc = true
) {
  return sort(Array(...group), averageTimePerWorkspace, desc)
}

export function sortGroupByAverageTimeDesc(
  group: Set<Workspace>,
  averageTimePerWorkspace: { [key: string]: number }
) {
  return sortGroupByAverageTime(group, averageTimePerWorkspace)
}

export function sortGroupByAverageTimeAsc(
  group: Set<Workspace>,
  averageTimePerWorkspace: { [key: string]: number }
) {
  return sortGroupByAverageTime(group, averageTimePerWorkspace, false)
}
