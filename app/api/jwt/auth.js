import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { access_key } from "./jwt";

export function auth(req) {
  const accessToken = req.cookies.get("accessToken")?.value;
  const refreshToken = req.cookies.get("refreshToken")?.value;

  // ❌ No tokens at all → not authenticated
  if (!accessToken && !refreshToken) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  // 1️⃣ Try verifying access token
  if (accessToken) {
    try {
     const payload  = jwt.verify(accessToken, process.env.JWT_ACCESS_KEY);
      const res = NextResponse.next();
      res.headers.set("x-user-id", payload.userId);
      return res;
    } catch (err) {
      // access token expired → try refresh
    }
  }

  // 2️⃣ Access token failed → try refresh token
  if (!refreshToken) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Verify refresh token
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_KEY
    );

    // Create new access token
    const newAccessToken = access_key(payload.userId);

    // Continue request with new token
    const res = NextResponse.next();
    res.headers.set("x-user-id", payload.userId);
    res.cookies.set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
    });

    return res;
  } catch (err) {
    // ❌ Refresh token invalid / expired
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }
}
