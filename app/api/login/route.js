import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { refresh_key, access_key } from "../jwt/jwt.js";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";

export async function POST(req) {
  const cookieStore = await cookies();
  const { email, password } = await req.json();

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return NextResponse.json({ message: "Invalid password" }, { status: 401 });
  }

  const accessToken = access_key(user.id);
  const refreshToken = refresh_key(user.id);

  cookieStore.set("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 10 * 60,
  });

  cookieStore.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  // ✅ Return name so the login page can store it in sessionStorage
  return NextResponse.json(
    { message: "Login successful", name: user.name },
    { status: 200 }
  );
}