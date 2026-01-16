import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { room_code } = await req.json();

    if (!room_code) {
      return NextResponse.json(
        { message: "roomId is required" },
        { status: 400 }
      );
    }

    // ✅ Only validate that the room exists
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
      {
        message: "Room exists. Join allowed.",
        room_code,
      },
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
