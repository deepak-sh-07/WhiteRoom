import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export async function POST(req) {
  try {
    const body = await req.json();
    const code = body.roomId; 

    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json(
        { message: "Valid room code is required" },
        { status: 400 }
      );
    }

    const room_code = code.trim();

    const room = await prisma.room.findUnique({
      where: { room_code },
    });

    if (!room) {
      return NextResponse.json(
        { message: "Room not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Room exists. Join allowed.", room_code },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
