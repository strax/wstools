import { toposort } from "../graph"
import { ProcessError } from "../ProcessError"
import { runCommand } from "../runner"
import * as Yarn from "../yarn"

async function main() {
  const args = process.argv.slice(2)
  const workspaces = await Yarn.findWorkspaces(process.cwd())
  let error = null
  for (const workspace of toposort(workspaces, ws => ws.dependencies)) {
    try {
      await runCommand(workspace, args)
    } catch (err) {
      if (err instanceof ProcessError) {
        error = err.code
      } else {
        throw err
      }
    }
  }
  if (error !== null) {
    process.exit(error)
  }
}

main()
