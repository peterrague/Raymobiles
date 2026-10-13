import "server-only"
import { unstable_rethrow } from "next/navigation"
import { ActionError, type ActionState } from "./errors"
import { isPreview } from "./preview"

export async function guard(work: () => Promise<ActionState>): Promise<ActionState> {
  if (await isPreview()) {
    return { error: "This is a preview. Sign-in is open so you can look around; changes are not saved." }
  }
  try {
    return await work()
  } catch (error) {
    unstable_rethrow(error)
    if (error instanceof ActionError) return { error: error.message }
    console.error(error)
    return { error: "Could not save that change." }
  }
}
