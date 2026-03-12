import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const ALLOWED_ORIGIN = process.env.CLIENT_URL ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] },
});

// ── Track host per room ───────────────────────────────────────────
const roomHosts = new Map();

// ── Track pending join requests ───────────────────────────────────
const pendingRequests = new Map();

// ── Rate limiter ──────────────────────────────────────────────────
function makeRateLimiter(maxCalls, windowMs) {
  const store = new Map();
  return function isAllowed(socketId) {
    const now = Date.now();
    const entry = store.get(socketId);
    if (!entry || now > entry.resetAt) {
      store.set(socketId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxCalls) return false;
    entry.count++;
    return true;
  };
}

const limits = {
  "join-request":  makeRateLimiter(5,  60_000),
  "offer":         makeRateLimiter(20, 10_000),
  "answer":        makeRateLimiter(20, 10_000),
  "ice-candidate": makeRateLimiter(60, 10_000),
};

function checkLimit(socket, event) {
  const limiter = limits[event];
  if (!limiter) return true;
  if (limiter(socket.id)) return true;
  console.warn(`🚫 Rate limit hit — socket ${socket.id} on event "${event}"`);
  socket.emit("rate-limited", { event, message: `Too many ${event} requests` });
  return false;
}

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("join-request", ({ roomId, name }) => {
    if (!checkLimit(socket, "join-request")) return;
    const host = roomHosts.get(roomId);
    if (!host) {
      admitToRoom(socket, roomId);
      return;
    }
    const requestId = `${socket.id}:${roomId}`;
    pendingRequests.set(requestId, { socketId: socket.id, roomId, name });
    socket.data.pendingRoom = roomId;
    io.to(host).emit("join-request", { requestId, peerId: socket.id, name: name ?? "Someone" });
    console.log(`⏳ ${socket.id} (${name}) waiting for host approval in "${roomId}"`);
  });

  socket.on("join-approve", ({ requestId }) => {
    const req = pendingRequests.get(requestId);
    if (!req) return;
    pendingRequests.delete(requestId);
    const joinerSocket = io.sockets.sockets.get(req.socketId);
    if (!joinerSocket) return;
    console.log(`✅ Host approved ${req.socketId} for "${req.roomId}"`);
    admitToRoom(joinerSocket, req.roomId);
  });

  socket.on("join-reject", ({ requestId }) => {
    const req = pendingRequests.get(requestId);
    if (!req) return;
    pendingRequests.delete(requestId);
    console.log(`❌ Host rejected ${req.socketId} for "${req.roomId}"`);
    io.to(req.socketId).emit("join-rejected", { roomId: req.roomId });
  });

  function admitToRoom(sock, roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    const existingPeers = room ? [...room] : [];
    const isHost = existingPeers.length === 0;
    sock.join(roomId);
    sock.data.roomId = roomId;
    if (isHost) roomHosts.set(roomId, sock.id);
    sock.emit("role", { role: isHost ? "host" : "peer" });
    sock.emit("room-peers", { peers: existingPeers });
    sock.emit("join-admitted");
    console.log(`${isHost ? "👑 HOST" : "👤 PEER"} ${sock.id} admitted to "${roomId}" | peers: [${existingPeers.join(", ")}]`);
    existingPeers.forEach(id => io.to(id).emit("peer-joined", { peerId: sock.id }));
  }

  socket.on("offer", ({ roomId, offer, targetId }) => {
    if (!checkLimit(socket, "offer")) return;
    console.log(`📨 offer ${socket.id} → ${targetId}`);
    io.to(targetId).emit("offer", { offer, fromId: socket.id });
  });

  socket.on("answer", ({ roomId, answer, targetId }) => {
    if (!checkLimit(socket, "answer")) return;
    console.log(`📨 answer ${socket.id} → ${targetId}`);
    io.to(targetId).emit("answer", { answer, fromId: socket.id });
  });

  socket.on("ice-candidate", ({ roomId, candidate, targetId }) => {
    if (!checkLimit(socket, "ice-candidate")) return;
    io.to(targetId).emit("ice-candidate", { candidate, fromId: socket.id });
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit("peer-left", { peerId: socket.id });
      if (roomHosts.get(roomId) === socket.id) {
        roomHosts.delete(roomId);
        console.log(`👑 Host ${socket.id} left "${roomId}" — host cleared`);
      }
    }
    for (const [id, req] of pendingRequests.entries()) {
      if (req.socketId === socket.id) pendingRequests.delete(id);
    }
  });
});

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => console.log(`🚀 Signaling server on :${PORT}`));