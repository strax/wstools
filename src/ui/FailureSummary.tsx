import { Box, Color } from "ink"
import React from "react"
import { ExecutionSummary } from "../runner"

export const FailureSummary: React.FC<{ failure: ExecutionSummary }> = ({ failure }) => (
  <Box flexDirection="column">
    <Box>
      <Color red>{failure.workspace}</Color>: Command '{failure.command}' failed.
    </Box>
    <Box>{failure.stderr!.trimEnd()}</Box>
  </Box>
)
