declare module "ink-spinner" {
  import React from "react"
  interface SpinnerProps {
    type: string
  }

  export default class Spinner extends React.Component<SpinnerProps> {}
}
