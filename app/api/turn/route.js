import twilio from "twilio";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const token = await client.tokens.create();
    return NextResponse.json(token.iceServers);

  } catch (err) {
    console.error("[twilio] Failed to fetch TURN credentials:", err.message);

    // Fallback to free Google STUN only — no TURN relay
    // Peers can still connect on most networks, just not behind strict NAT
    return NextResponse.json([
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ]);
  }
}