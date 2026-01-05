import jwt from "jsonwebtoken"
if (!process.env.JWT_ACCESS_KEY || !process.env.JWT_REFRESH_KEY) {
  throw new Error("JWT secrets are not defined");
}
 export const access_key = (userId)=>{
   return jwt.sign({userId},process.env.JWT_ACCESS_KEY,{expiresIn:"10m"})
}
export const refresh_key = (userId)=>{
    return jwt.sign({userId},process.env.JWT_REFRESH_KEY,{expiresIn:"7d"})
}