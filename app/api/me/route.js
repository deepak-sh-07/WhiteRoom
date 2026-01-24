import { NextResponse } from "next/server";

export function GET(req) {
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json(
      { message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { message: "Fine", userId },
    { status: 200 }
  );
}
