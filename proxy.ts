import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { PREVIEW_COOKIE } from "@/lib/preview-cookie"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token =
    request.cookies.get("__Secure-authjs.session-token")?.value ??
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get(PREVIEW_COOKIE)?.value
  const isPublic = pathname === "/" || pathname.startsWith("/api/auth")

  if (!token && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (token && pathname === "/" && !request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
