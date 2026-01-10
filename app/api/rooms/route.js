import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  const userId = Number(req.headers.get("x-user-id"));
  console.log(userId);
  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { name, room_code } = await req.json();

  const existingRoom = await prisma.room.findUnique({
    where: { room_code },
  });

  if (existingRoom) {
    return NextResponse.json(
      { message: "Room already exists" },
      { status: 409 }
    );
  }

  const createRoom = await prisma.room.create({
    data: {
      name,
      room_code,
      createdById: userId,
    },
  });

  return NextResponse.json(
    {
      message: "Room created",
      room: createRoom,
    },
    { status: 201 }
  );
}
