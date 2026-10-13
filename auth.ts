import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async signIn({ profile }) {
      const google = profile as
        | { email?: string | null; name?: string | null; picture?: string | null; email_verified?: boolean }
        | undefined
      if (!google?.email || google.email_verified === false) return false
      const { allowGoogleSignIn } = await import("@/lib/provision")
      return allowGoogleSignIn({
        email: google.email,
        name: google.name,
        image: google.picture,
      })
    },
  },
})
