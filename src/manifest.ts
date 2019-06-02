import { promises as FS } from "fs"
import Path from "path"

export interface Manifest {
  name: string
  version: string
  scripts?: Record<string, string>
}

export async function readManifest(dirname: string) {
  const manifestPath = Path.resolve(dirname, "package.json")
  const data = await FS.readFile(manifestPath, { encoding: "utf-8" })
  return JSON.parse(data.toString()) as Manifest
}
