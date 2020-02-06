import { Deferred } from "@esfx/async"
import * as ChildProcess from "child_process"

interface LogOutput {
  type: string
  data: string
}

export interface WorkspaceInfo {
  location: string
  workspaceDependencies: Array<string>
  mismatchedWorkspaceDependencies: Array<string>
}

export type WorkspaceInfoMap = Record<string, WorkspaceInfo>

async function exec(command: string, options: { cwd?: string } = {}): Promise<string> {
  const deferred = new Deferred<string>()
  ChildProcess.exec(command, { timeout: 5000, ...options }, (err, stdout, stderr) => {
    if (err) {
      process.stderr.write(stderr)
      deferred.reject(err)
    } else {
      deferred.resolve(stdout)
    }
  })
  return deferred.promise
}

export async function workspacesInfo(cwd: string): Promise<WorkspaceInfoMap> {
  try {
    const workspaceInfoMap = JSON.parse(await exec("yarn workspaces info --json", { cwd })) as WorkspaceInfoMap
    return workspaceInfoMap
  } catch (err) {
    throw new Error(`failed to parse workspace info: ${(err as Error).message}`)
  }
}

export async function findWorkspaces(cwd: string): Promise<Array<Workspace>> {
  const infoMap = await workspacesInfo(cwd)
  const index = new Map<string, Workspace>()
  // First pass: Generate entries for all packages
  for (const [name, info] of Object.entries(infoMap)) {
    const workspace: Workspace = { name, path: info.location, dependencies: [] }
    index.set(name, workspace)
  }
  // Second pass: inject dependencies
  for (const [name, info] of Object.entries(infoMap)) {
    if (info.mismatchedWorkspaceDependencies.length > 0) {
      throw new Error(
        `mismatched workspace dependency: ${name} > ${info.mismatchedWorkspaceDependencies[0]}`
      )
    }
    const workspace = index.get(name)!
    for (const dep of info.workspaceDependencies) {
      workspace.dependencies.push(index.get(dep)!)
    }
  }
  return Array.from(index.values())
}
