interface Workspace {
  path: string
  name: string
  dependencies: Array<Workspace>
}
