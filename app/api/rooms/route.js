import { NextResponse } from "next/server";
import { headers } from "next/headers";


export async function POST(req){
    const {name,room_code} = req.body();
    const userId = headers().get("x-user-id");
    const room = prisma.room.findmany({
        where:{room_code}
    })
    if(room) return NextResponse.json({message:"Room already exist"} , {status:404});

    const createRoom = prisma.room.create({
        data:{
            name,
            room_code,
            createdById:userId,
        }
    })
    return NextResponse.json({message:"room created"}, {status:200},{createRoom})
}