import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean)
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || ""

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          hd: ALLOWED_DOMAIN || undefined,
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (ALLOWED_DOMAIN && user.email) {
        return user.email.endsWith(`@${ALLOWED_DOMAIN}`)
      }
      return true
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        (session.user as any).role = ADMIN_EMAILS.includes(token.email) ? "admin" : "viewer"
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email
      }
      return token
    },
  },
})
