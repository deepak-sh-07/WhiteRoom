import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("join-room", (roomId) => {
    // Get ALL current members BEFORE this socket joins
    const room = io.sockets.adapter.rooms.get(roomId);
    const existingPeers = room ? [...room] : [];
    const isHost = existingPeers.length === 0;

    socket.join(roomId);
    socket.data.roomId = roomId;

    // Assign role
    socket.emit("role", { role: isHost ? "host" : "peer" });

    // Tell newcomer about EVERY existing peer — they will offer each one
    socket.emit("room-peers", { peers: existingPeers });
    console.log(`${isHost ? "👑 HOST" : "👤 PEER"} ${socket.id} joined "${roomId}" | sending peers: [${existingPeers.join(", ")}]`);

    // Tell every existing peer the newcomer arrived — they must be ready to answer
    existingPeers.forEach(id => {
      io.to(id).emit("peer-joined", { peerId: socket.id });
      console.log(`  → notified ${id} about newcomer ${socket.id}`);
    });
  });

  socket.on("offer", ({ roomId, offer, targetId }) => {
    console.log(`📨 offer ${socket.id} → ${targetId}`);
    io.to(targetId).emit("offer", { offer, fromId: socket.id });
  });

  socket.on("answer", ({ roomId, answer, targetId }) => {
    console.log(`📨 answer ${socket.id} → ${targetId}`);
    io.to(targetId).emit("answer", { answer, fromId: socket.id });
  });

  socket.on("ice-candidate", ({ roomId, candidate, targetId }) => {
    io.to(targetId).emit("ice-candidate", { candidate, fromId: socket.id });
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit("peer-left", { peerId: socket.id });
  });
});

server.listen(3001, () => console.log("🚀 Signaling server on :3001"));