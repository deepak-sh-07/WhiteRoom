import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
const app = express();
app.use(cors());
const server = http.createServer(app);
const PORT = process.env.PORT;
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Next.js frontend
    methods: ["GET", "POST"],
  },
});

io.on("connection",(socket)=>{
    
})
app.listen(PORT,()=>{
  console.log("BACKEND SERVER is running");
})