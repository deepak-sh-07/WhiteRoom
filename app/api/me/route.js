import { NextResponse } from "next/server";
export default function GET(req){
    const userId = (req.headers.get("x-user-id"));
    if(!userId) return NextResponse.json({status:404,message:"User not found"});
    return NextResponse.json({status:200,message:"Fine"});
}