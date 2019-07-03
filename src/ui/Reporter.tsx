import { Box, Color, Static, Text } from "ink"
import React from "react"
import { FailureTaskState, State, SuccessTaskState, TaskState, RunningTaskState } from "../TaskState"
import { Timer } from "../Timer"
import { Progress } from "./Progress"
import { TTY } from "./TTY"
import { Elapsed } from "./Elapsed";

export interface ReporterProps {
  timer: Timer
  tasks: Array<TaskState>
  showSummary: boolean
}

const TaskResultView: React.SFC<{ state: SuccessTaskState | FailureTaskState }> = ({ state }) => {
  if (state.state === State.Success) {
    return (
      <Box>
        {state.workspace.name}: <Color green>success</Color> ({state.duration.toFixed(0)}ms)
      </Box>
    )
  } else {
    return (
      <Box flexDirection="column">
        <Box>
          <Color red>{state.workspace.name}: failure</Color>
        </Box>
        <Text>{state.output}</Text>
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
  return (
    <>
      <Box flexDirection="column">
        <Static>
          {finishedTasks.map((state, i) => (
            <TaskResultView state={state} key={i} />
          ))}
        </Static>
      </Box>
      <TTY>
        <Box flexDirection="column">
          {runningTasks.map(state => (
            <Box flexDirection="column" key={state.workspace.name}>
              <Box>
                {state.workspace.name}: <Color dim>running (<Elapsed timer={state.timer} />)</Color>
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
