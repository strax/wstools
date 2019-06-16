# wstools

`wstools` is a suite of command-line utilities for working with Yarn workspaces.

## Available commands

So far, `wstools` contains two (usable) commands: [wsrun](#wsrun) and [wsviz](#wsviz).

### `wsrun`

`wsrun` is an utility that runs a given `package.json` script in each workspace **in parallel**.
It builds a dependency graph from the workspace and ensures a workspace is built only after its dependencies.
The current state of the tool does not allow customizing the amount of parallel tasks but rather is fixed to `n - 1` where `n` is the amount of the cores available in the machine.

### `wsviz`

`wzviz` generates [DOT](https://en.wikipedia.org/wiki/DOT_(graph_description_language)) markup for the current workspace's execution graph.
In other words, it shows a visualization of the partial ordering in which `wsrun` would run tasks. The output of this tool is intended to be piped to other commands, for example graphviz.

## License

MIT