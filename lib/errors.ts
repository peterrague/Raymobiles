export class ActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActionError"
  }
}

export type ActionState = {
  error?: string
  ok?: boolean
}
