import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user }, { status: 200 });
}