import prisma  from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
export async function POST(req, res) {
    const body = await req.json();

    const { email, password,name } = body;

    let user = await prisma.user.findUnique({
        where: {
            email:email,
        },
    });

    if (user) {
        return NextResponse.json(
            { message: "User found" },
            { status: 404 }
        );
    }
    else {
        const hashed_paas = await bcrypt.hash(password,10); 
        user = await prisma.user.create({
            data: {
                email,password:hashed_paas,name
            }
        })
        return NextResponse.json(
        { message: "User created successful", user:user },
        { status: 200 }
    );
    }



    
}
