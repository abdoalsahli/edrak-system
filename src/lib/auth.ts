import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { UserRole } from "@/lib/enums";

const loginSchema = z.object({
  // Stored in lower case; PostgreSQL compares text case-sensitively
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 hours
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
            select: { id: true, name: true, email: true, password: true, role: true, isActive: true },
          });

          if (!user || !user.isActive) return null;

          const valid = await bcrypt.compare(parsed.data.password, user.password);
          if (!valid) return null;

          return { id: user.id, name: user.name, email: user.email, role: user.role as UserRole };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role: UserRole }).role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as { role: UserRole }).role = token.role as UserRole;
      }
      return session;
    },
  },
});
