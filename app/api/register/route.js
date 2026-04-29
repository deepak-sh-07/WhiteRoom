import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(req) {
  const { email, password, name } = await req.json();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // ✅ Fixed: was returning 404, should be 409 Conflict
    return NextResponse.json({ message: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, password: hashed, name },
  });

  return NextResponse.json(
    { message: "User created successfully", user: { id: user.id, name: user.name, email: user.email } },
    { status: 201 }
  );
}