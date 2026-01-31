import twilio from "twilio"; // used 662 for login 
//Twilio is a cloud platform that provides ready-made communication infrastructure (APIs) so developers don’t have to build or host it themselves.
import { NextResponse } from "next/server";

export async function GET(){
    const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const token = await client.tokens.create();
  return NextResponse.json(token.iceServers);
}