// app/api/snapshots/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";


// POST /api/snapshots
// Body: { roomCode: string, label: string, state: string (base64) }
export async function POST(req) {
  try {
    const { roomCode, label, state } = await req.json();

    if (!roomCode || !state) {
      return NextResponse.json({ error: "roomCode and state are required" }, { status: 400 });
    }

    // Look up room by room_code
    const room = await prisma.room.findUnique({
      where: { room_code: roomCode },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const snapshot = await prisma.snapshot.create({
      data: {
        roomId: room.id,
        label:  label ?? new Date().toLocaleTimeString(),
        state,  // base64 string
      },
    });

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (e) {
    console.error("[snapshots POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}