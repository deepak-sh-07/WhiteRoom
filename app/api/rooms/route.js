import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  const userId = Number(req.headers.get("x-user-id"));

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

  const room = await prisma.$transaction(async (tx) => {// this trasactions is a prisma function and all the queries inside this function are treated as one if one of them fails all is failed 
    const createdRoom = await tx.room.create({
      data: {
        name,
        room_code,
        createdById: userId,
      },
    });

    await tx.roomUser.create({
      data: {
        userId,
        roomId: createdRoom.id,
        role: "HOST",
        status: "APPROVED",
      },
    });

    return createdRoom;
  });

  return NextResponse.json(
    {
      message: "Room created",
      room,
    },
    { status: 201 }
  );
}
