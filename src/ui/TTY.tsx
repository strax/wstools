import React from "react"
import { StdoutContext } from "ink";

export const TTY: React.FC = props => (
  <StdoutContext.Consumer>{({stdout}) => stdout.isTTY ? props.children : null}</StdoutContext.Consumer>
)