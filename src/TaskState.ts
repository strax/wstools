import { Timer } from "./Timer";

export enum State {
  Pending,
  Running,
  Success,
  Failure,
  Aborted
}

interface PendingTaskState {
  state: State.Pending
  workspace: Workspace
}

export interface RunningTaskState {
  state: State.Running
  workspace: Workspace
  timer: Timer
}

export interface SuccessTaskState {
  state: State.Success
  workspace: Workspace
  duration: number
  output: string
}

export interface FailureTaskState {
  state: State.Failure
  workspace: Workspace
  duration: number
  output: string
}

export interface AbortedTaskState {
  state: State.Aborted
  workspace: Workspace
}

export type TaskState = PendingTaskState | RunningTaskState | SuccessTaskState | FailureTaskState | AbortedTaskState 
