import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { access_key } from "./jwt";

export function auth(req) {
  console.log("Auth working")
  const accessToken = req.cookies.get("accessToken")?.value;
  const refreshToken = req.cookies.get("refreshToken")?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  
  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, process.env.JWT_ACCESS_KEY);

      const headers = new Headers(req.headers);
      headers.set("x-user-id", payload.userId);
      console.log("1" , payload.userId)
      return NextResponse.next({
        request: { headers },
      });
    } catch {}
  }

  // 2️ Refresh token
  if (!refreshToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY);
    const newAccessToken = access_key(payload.userId);

    const headers = new Headers(req.headers);
    headers.set("x-user-id", payload.userId);
    console.log("2" , payload.userId)
    const res = NextResponse.next({
      request: { headers },
    });

    res.cookies.set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 10 * 60,
    });

    return res;
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}
