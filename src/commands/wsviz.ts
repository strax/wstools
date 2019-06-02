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

  process.stdout.write(`
digraph dependencies {
  ${workspaces.map(_ => `"${_.name}"`).join("\n  ")}
  ${edges.map(([from, to]) => `"${from}" -> "${to}"`).join("\n  ")}
}
`)
}

main()
