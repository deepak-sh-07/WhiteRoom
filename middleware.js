import { auth } from "./app/api/jwt/auth";
import { NextRequest } from "next/server";
export const runtime = "nodejs";
export function middleware(req) {
  return auth(req);
}
export const config = {
  matcher: [
    "/api/rooms/:path*",
    "/api/join/:path*",
    "/api/me/:path*",
    "/room/:path*",
  ],
};
