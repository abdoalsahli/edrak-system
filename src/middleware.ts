import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

const PUBLIC_PATHS = ["/login"];

/** The therapist portal: a THERAPIST account sees these pages and nothing else. */
const THERAPIST_HOME = "/my/schedule";
const isTherapistPath = (p: string) => p === "/my" || p.startsWith("/my/");

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = (req.auth?.user as { role?: UserRole } | undefined)?.role;
  const home = role === "THERAPIST" ? THERAPIST_HOME : "/dashboard";

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (req.auth) {
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // API routes check roles themselves (a therapist only passes routes that name THERAPIST)
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // Pages: a therapist stays inside the portal, staff stay outside it
  if (role === "THERAPIST" && !isTherapistPath(pathname)) {
    return NextResponse.redirect(new URL(THERAPIST_HOME, req.url));
  }
  if (role !== "THERAPIST" && isTherapistPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
