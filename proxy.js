import { auth } from "./app/api/jwt/auth";
export function proxy(req) {
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
