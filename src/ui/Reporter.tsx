import { Box, Color, Static, Text } from "ink"
import React from "react"
import { ExecutionSummary } from "../runner"
import { Timer } from "../Timer"
import { Progress } from "./Progress"
import { TTY } from "./TTY"

export interface ReporterProps {
  timer: Timer
  finishedTasks: Array<ExecutionSummary>
  runningTasks: ReadonlySet<string>
  totalTasks: number
  showSummary: boolean
}

const TaskResultView: React.SFC<{ data: ExecutionSummary }> = ({ data }) => {
  if (data.succeeded) {
    return (
      <Box>
        <Color greenBright>{data.workspace.name}</Color>:{" "}
        <Box textWrap="truncate-end">{data.command}</Box>{" "}
        <Color dim>({data.duration.toFixed(0)}ms)</Color>
      </Box>
    )
  } else {
    return (
      <Box flexDirection="column">
        <Box>
          <Color red>{data.workspace.name}</Color>:{" "}
          <Box textWrap="truncate-end">{data.command}</Box>
        </Box>
        {data.output && <Text>{data.output}</Text>}
      </Box>
    )
  }
}

export const Reporter: React.FC<ReporterProps> = props => {
  return (
    <>
      <Box flexDirection="column">
        <Static>
          {props.finishedTasks.map(summary => (
            <TaskResultView data={summary} key={summary.workspace.name} />
          ))}
        </Static>
      </Box>
      {props.showSummary && (
        <TTY>
          <Progress
            finishedTasksCount={props.finishedTasks.length}
            totalTaskCount={props.totalTasks}
            runningTasks={props.runningTasks}
            timer={props.timer}
          />
        </TTY>
      )}
    </>
  )
}
