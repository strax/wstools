import { Box, Color, Static, Text } from "ink"
import React from "react"
import {
  FailureTaskState,
  RunningTaskState,
  State,
  SuccessTaskState,
  TaskState
} from "../TaskState"
import { Timer } from "../Timer"
import { Elapsed } from "./Elapsed"
import { Progress } from "./Progress"
import { TTY } from "./TTY"
import { showSeconds, showMilliseconds } from "./showTime";

export interface ReporterProps {
  timer: Timer
  tasks: Array<TaskState>
  showSummary: boolean
}

const TaskResultView: React.SFC<{
  state: SuccessTaskState | FailureTaskState
  maxNameWidth: number
}> = ({ state, maxNameWidth }) => {
  if (state.state === State.Success) {
    return (
      <Box flexDirection="row">
        <Box flexBasis={maxNameWidth} marginRight={2}>{state.workspace.name}</Box>
        <Box>
          <Color green bold>success</Color> {state.duration > 1000 ? `${showSeconds(state.duration)}s` : `${showMilliseconds(state.duration)}ms`}
        </Box>
      </Box>
    )
  } else {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Color red>
            <Box flexBasis={maxNameWidth} marginRight={2}>{state.workspace.name}</Box>
            <Box><Color bold>failure</Color></Box>
          </Color>
        </Box>
        <Box marginTop={1}>
          {state.output.trim()}
        </Box>
      </Box>
    )
  }
}

function isFinished(task: TaskState): task is SuccessTaskState | FailureTaskState {
  return task.state === State.Success || task.state === State.Failure
}

function isRunning(task: TaskState): task is RunningTaskState {
  return task.state === State.Running
}
export const Reporter: React.FC<ReporterProps> = props => {
  const finishedTasks = props.tasks.filter(isFinished)
  const runningTasks = props.tasks.filter(isRunning)
  const maxNameWidth = props.tasks
    .map(_ => _.workspace.name.length)
    .reduce((a, b) => Math.max(a, b))
  return (
    <>
      <Box flexDirection="column">
        <Static>
          {finishedTasks.map((state, i) => (
            <TaskResultView state={state} key={i} maxNameWidth={maxNameWidth} />
          ))}
        </Static>
      </Box>
      <TTY>
        <Box flexDirection="column">
          {runningTasks.map(state => (
            <Box flexDirection="column" key={state.workspace.name}>
              <Box flexDirection="row">
                <Box flexBasis={maxNameWidth} marginRight={2}>{state.workspace.name}</Box>
                <Box>
                  <Color dim>
                    running <Elapsed timer={state.timer} />
                  </Color>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
        {props.showSummary && (
          <Progress
            finishedTasksCount={finishedTasks.length}
            totalTaskCount={props.tasks.length}
            timer={props.timer}
          />
        )}
      </TTY>
    </>
  )
}
