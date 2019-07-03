import React from "react"
import { Timer } from "../Timer";
import { Text } from "ink";
import { showSeconds } from "./showTime";

interface Props {
  timer: Timer
}

interface State {
  current: number
}

export class Elapsed extends React.Component<Props, State> {

  private timeout!: NodeJS.Timeout

  constructor(props: Props) {
    super(props)
    this.state = { current: props.timer() }
  }

  componentDidMount() {
    this.timeout = setInterval(
      () =>
        this.setState({
          current: this.props.timer()
        }),
      150
    )
  }

  componentWillUnmount() {
    clearInterval(this.timeout)
  }

  render() {
    return <Text>{showSeconds(this.state.current)}s</Text>
  }
}
