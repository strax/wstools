import FS from "fs"
import Path from "path"
import { promisify as encase } from "util"

export interface Manifest {
  name: string
  version: string
  scripts?: Record<string, string>
}

const readFile = encase(FS.readFile)

export async function readManifest(dirname: string) {
  const manifestPath = Path.resolve(dirname, "package.json")
  const data = await readFile(manifestPath, { encoding: "utf-8" })
  return JSON.parse(data.toString()) as Manifest
}
