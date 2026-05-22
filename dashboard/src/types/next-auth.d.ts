import "next-auth"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      role?: "admin" | "viewer"
    } & DefaultSession["user"]
  }
}
