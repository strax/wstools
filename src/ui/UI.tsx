import { Box, Color, Static, StdoutContext, Text } from "ink"
import Spinner from "ink-spinner"
import React from "react"
import { ExecutionSummary } from "../runner"
import { Timer } from "../Timer"
import { showSeconds } from "./showTime"

export interface UIProps {
  timer: Timer
  finishedTasks: Array<ExecutionSummary>
  runningTasks: ReadonlySet<string>
  totalTasks: number
}

export interface State {
  currentTime: number
}

const TaskResultView: React.SFC<{ data: ExecutionSummary }> = ({ data }) => {
  if (data.succeeded) {
    return (
      <Box>
        <Color greenBright>{data.workspace}</Color>:{" "}
        <Box textWrap="truncate-end">{data.command}</Box>{" "}
        <Color dim>({data.duration.toFixed(0)}ms)</Color>
      </Box>
    )
  } else {
    return (
      <Box flexDirection="column">
        <Box>
          <Color red>{data.workspace}</Color>: <Box textWrap="truncate-end">{data.command}</Box>
        </Box>
        {data.stderr && <Text>{data.stderr}</Text>}
      </Box>
    )
  }
}

export class UI extends React.Component<UIProps, State> {
  private interval!: NodeJS.Timeout

  state: State = { currentTime: 0 }

  componentDidMount() {
    this.interval = setInterval(
      () =>
        this.setState({
          currentTime: this.props.timer()
        }),
      150
    )
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  render() {
    return (
      <>
        <Box flexDirection="column">
          <Static>
            {this.props.finishedTasks.map(summary => (
              <TaskResultView data={summary} key={summary.workspace} />
            ))}
          </Static>
        </Box>
        <StdoutContext.Consumer>
          {({ stdout }) =>
            stdout.isTTY && (
              <Box marginTop={1}>
                <Color blue>
                  <Spinner type="dot" />
                </Color>{" "}
                Progress: {this.props.finishedTasks.length}/{this.props.totalTasks} Running:{" "}
                {Array.from(this.props.runningTasks).join(", ")} (
                {showSeconds(this.state.currentTime)}s)
              </Box>
            )
          }
        </StdoutContext.Consumer>
      </>
    )
  }
}
