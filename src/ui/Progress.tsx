import { Box, Color } from "ink"
import Spinner from "ink-spinner"
import React from "react"
import { Timer } from "../Timer"
import { Elapsed } from "./Elapsed"

interface Props {
  finishedTasksCount: number
  totalTaskCount: number
  timer: Timer
}

export const Progress: React.FC<Props> = props => (
  <Box marginTop={1}>
    <Color blue>
      <Spinner type="dot" />
    </Color>{" "}
    Progress: {props.finishedTasksCount}/{props.totalTaskCount} (<Elapsed timer={props.timer} />)
  </Box>
)
