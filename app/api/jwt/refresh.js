import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { access_key } from "./jwt.js";

export async function POST(req) {
  const refreshToken = cookies().get("refreshToken")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { message: "No refresh token" },
      { status: 401 }
    );
  }

  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_KEY
    );

    const newAccessToken = access_key(payload.userId);

    cookies().set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 10 * 60,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { message: "Invalid or expired refresh token" },
      { status: 401 }
    );
  }
}
