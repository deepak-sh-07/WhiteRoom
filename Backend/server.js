import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Track host per room
const roomHosts = new Map(); // roomId → hostSocketId

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("join-room", (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const isHost = !room || room.size === 0;

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.isHost = isHost;

    if (isHost) {
      roomHosts.set(roomId, socket.id);
      socket.emit("role", { role: "host" });
      socket.emit("room-peers", { peers: [], isHost: true });
      console.log(`👑 ${socket.id} is HOST of ${roomId}`);
    } else {
      // Tell the new peer who the host is
      const hostId = roomHosts.get(roomId);
      socket.emit("role", { role: "peer" });
      socket.emit("room-peers", { peers: hostId ? [hostId] : [], isHost: false });
      // Tell the host a new peer joined
      if (hostId) io.to(hostId).emit("peer-joined", { peerId: socket.id });
      console.log(`👤 ${socket.id} joined ${roomId} as peer, host: ${hostId}`);
    }
  });

  // Targeted signaling
  socket.on("offer", ({ roomId, offer, targetId }) => {
    if (targetId) {
      io.to(targetId).emit("offer", { offer, fromId: socket.id });
    } else {
      socket.to(roomId).emit("offer", { offer, fromId: socket.id });
    }
  });

  socket.on("answer", ({ roomId, answer, targetId }) => {
    if (targetId) {
      io.to(targetId).emit("answer", { answer, fromId: socket.id });
    } else {
      socket.to(roomId).emit("answer", { answer, fromId: socket.id });
    }
  });

  socket.on("ice-candidate", ({ roomId, candidate, targetId }) => {
    if (targetId) {
      io.to(targetId).emit("ice-candidate", { candidate, fromId: socket.id });
    } else {
      socket.to(roomId).emit("ice-candidate", { candidate, fromId: socket.id });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (socket.data.isHost) {
      roomHosts.delete(roomId);
      // Notify all peers host left
      socket.to(roomId).emit("peer-left", { peerId: socket.id });
    } else {
      // Notify host that peer left
      const hostId = roomHosts.get(roomId);
      if (hostId) io.to(hostId).emit("peer-left", { peerId: socket.id });
    }
  });
});

server.listen(3001, () =>
  console.log("🚀 Signaling server running on port 3001")
);