import { auth } from "./app/api/jwt/auth";
import { NextRequest } from "next/server";
export const runtime = "nodejs";
export function middleware(req: NextRequest) {
  console.log("MIDDLEWARE HIT");
  console.log("COOKIES:", req.cookies.getAll());
  return auth(req);
}
export const config = {
  matcher: [
    "/api/rooms/:path*",
  ],
};
