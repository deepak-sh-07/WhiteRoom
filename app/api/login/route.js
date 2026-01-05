import  prisma  from "@/lib/prisma";
import { NextResponse } from "next/server";
import {refresh_key,access_key} from "../jwt/jwt.js";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";
export async function POST(req, res) {
  const body = await req.json();

  const { email, password } = body;


  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    console.log("not found user")
    return NextResponse.json(
      { message: "User not found" },
      { status: 404 }
    );
  }
  const Isvalid = await bcrypt.compare(password,user.password);
  if (!Isvalid) {
    console.log("galat pass")
    return NextResponse.json(
      { message: "Invalid password" },
      { status: 401 }
    );
  }
  const accessToken = access_key(user.id);
  const refreshToken = refresh_key(user.id);

 cookies().set("accessToken", accessToken, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  maxAge: 10 * 60, 
});

cookies().set("refreshToken", refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  maxAge: 7 * 24 * 60 * 60, 
});


  
  return NextResponse.json(
    {
      message: "Login successful",
      accessToken,
    },
    { status: 200 }
  );
}
