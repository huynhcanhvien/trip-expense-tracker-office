// Auth.js (NextAuth v5) config — spec R8. Implemented in T5.
//
// Credentials provider + JWT sessions. (The Credentials provider only supports
// the JWT session strategy, so no DB-session adapter is used; accounts and the
// verification/reset tokens live in our own tables — see src/lib/accounts.ts,
// src/db/schema.sql, and plan §3.3.)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "./accounts";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const email = typeof creds?.email === "string" ? creds.email : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        const user = await verifyCredentials(email, password);
        // Block sign-in until the email is verified (spec R8). The login action
        // surfaces the friendly "check your inbox" message; this is the hard gate.
        if (!user || !user.emailVerified) return null;
        return { id: String(user.id), email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = String(token.id);
      return session;
    },
  },
});
