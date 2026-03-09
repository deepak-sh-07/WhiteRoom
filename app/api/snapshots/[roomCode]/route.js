// app/api/snapshots/[roomCode]/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/snapshots/[roomCode]
export async function GET(req, context) {
  try {
    const params   = await context.params;
    const roomCode = params.roomCode;

    const room = await prisma.room.findFirst({
      where: { room_code: roomCode },
    });

    if (!room) {
      // Room not in DB yet — return empty list instead of 404
      return NextResponse.json({ snapshots: [] });
    }

    const snapshots = await prisma.snapshot.findMany({
      where:   { roomId: room.id },
      orderBy: { createdAt: "desc" },
      select:  { id: true, label: true, state: true, createdAt: true },
    });

    return NextResponse.json({ snapshots });
  } catch (e) {
    console.error("[snapshots GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/snapshots/[roomCode]?id=123
export async function DELETE(req, context) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id"));

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.snapshot.deleteMany({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("[snapshots DELETE]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}