import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { PREVIEW_COOKIE, previewRoleFromCookie } from "@/lib/preview-cookie"

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const preview = previewRoleFromCookie(request.cookies.get(PREVIEW_COOKIE)?.value)
  const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.get(name)?.value)
  // Auth.js cannot read a session without AUTH_SECRET, and an unreadable cookie
  // still looks signed-in. /dashboard then sends the browser to /, and / sends
  // it back, so the page refreshes until the cookie is ignored.
  const sessionCounts = hasSessionCookie && Boolean(process.env.AUTH_SECRET)
  const signedIn = Boolean(preview) || sessionCounts
  const isPublic = pathname === "/" || pathname.startsWith("/api/auth")

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return rememberRegion(dropUnreadSession(NextResponse.redirect(url), request), request)
  }

  if (signedIn && pathname === "/" && !request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return rememberRegion(NextResponse.redirect(url), request)
  }

  return rememberRegion(dropUnreadSession(NextResponse.next(), request), request)
}

function rememberRegion(response: NextResponse, request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region")
  if (region && /^[0-9a-f-]{36}$/i.test(region)) {
    response.cookies.set("desk-region", region, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 90,
    })
  }
  return response
}

function dropUnreadSession(response: NextResponse, request: NextRequest) {
  if (process.env.AUTH_SECRET) return response
  for (const name of SESSION_COOKIES) {
    if (!request.cookies.get(name)?.value) continue
    const secure = name.startsWith("__Secure-") ? "; Secure" : ""
    response.headers.append("set-cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`)
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
