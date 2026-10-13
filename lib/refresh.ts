import "server-only"
import { revalidatePath } from "next/cache"

const PATHS = ["/dashboard", "/stock", "/sales", "/prices", "/cash", "/reports", "/team", "/audit"]

export function refreshDesk() {
  for (const path of PATHS) revalidatePath(path)
}
