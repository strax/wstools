import { Box } from "ink"
import React from "react"
import { showSeconds } from "./showTime"

interface Props {
  taskCount: number
  elapsedTime: number
}

export const SuccessSummary: React.FC<Props> = ({ elapsedTime, taskCount }) => (
  <Box marginTop={1}>
    Completed {taskCount} tasks in {showSeconds(elapsedTime)}s
  </Box>
)
