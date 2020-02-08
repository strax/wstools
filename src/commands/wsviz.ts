import { partition } from "../graph"
import * as Yarn from "../yarn"

function flatten<T>(arr: Array<Array<T>>): Array<T> {
  const res: Array<T> = []
  for (const as of arr) {
    for (const b of as) {
      res.push(b)
    }
  }
  return res
}

async function main() {
  const workspaces = await Yarn.findWorkspaces(process.cwd())
  const edges = flatten(workspaces.map(ws => ws.dependencies.map(dep => [ws.name, dep.name])))
  const series = partition(workspaces, _ => _.dependencies)

  process.stdout.write(`
digraph dependencies {
  ${flatten(Array.from(series))
    .map(
      (workspaces, i) =>
        `subgraph {
      rank="same"
      ${Array.from(workspaces)
        .map(_ => `"${_.name}"`)
        .join("\n  ")}}`
    )
    .join("\n")}
  ${edges.map(([from, to]) => `"${to}" -> "${from}"`).join("\n  ")}
}
`)
}

main()
