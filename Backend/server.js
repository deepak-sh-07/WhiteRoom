import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import cors from "cors";

const ALLOWED_ORIGIN = process.env.CLIENT_URL ?? "http://localhost:3000";
const REDIS_URL      = process.env.REDIS_URL    ?? "redis://localhost:6379";

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));

// ── Health check endpoint (load balancer pings this) ──────────────
app.get("/health", (req, res) => res.json({ status: "ok", pid: process.pid }));

// ── Dev only: manually clear a stale room ────────────────────────
app.delete("/dev/room/:roomId", async (req, res) => {
  const { roomId } = req.params;
  await clearHost(roomId);
  console.log(`🧹 Manually cleared stale host for room "${roomId}"`);
  res.json({ cleared: roomId });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] },
  cookie: true,
});

// ══════════════════════════════════════════
//  REDIS SETUP
// ══════════════════════════════════════════
const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();

pubClient.on("error", e => console.error("[redis:pub]", e.message));
subClient.on("error", e => console.error("[redis:sub]", e.message));
pubClient.on("connect", () => console.log("✅ Redis connected"));

// Socket.io Redis adapter — makes all servers share socket events
io.adapter(createAdapter(pubClient, subClient));

// ── Redis key helpers ─────────────────────────────────────────────
const KEY = {
  roomHost:    (roomId)          => `whiteroom:host:${roomId}`,
  pendingReq:  (requestId)       => `whiteroom:req:${requestId}`,
  socketRoom:  (socketId)        => `whiteroom:socket:${socketId}`,
  rateLimiter: (socketId, event) => `whiteroom:rate:${socketId}:${event}`,
  pendingReqs: (socketId)        => `whiteroom:pendingreqs:${socketId}`,
  approveLock: (requestId)       => `whiteroom:lock:${requestId}`,
};

// ── Redis state helpers ───────────────────────────────────────────
async function getHost(roomId) {
  return pubClient.get(KEY.roomHost(roomId));
}

async function setHost(roomId, socketId) {
  await pubClient.set(KEY.roomHost(roomId), socketId, "EX", 86400);
}

async function clearHost(roomId) {
  await pubClient.del(KEY.roomHost(roomId));
}

async function setPendingRequest(requestId, data) {
  const socketId = data.socketId;
  await Promise.all([
    pubClient.set(KEY.pendingReq(requestId), JSON.stringify(data), "EX", 300),
    pubClient.sadd(KEY.pendingReqs(socketId), requestId),
    pubClient.expire(KEY.pendingReqs(socketId), 300),
  ]);
}

async function getPendingRequest(requestId) {
  const raw = await pubClient.get(KEY.pendingReq(requestId));
  return raw ? JSON.parse(raw) : null;
}

async function deletePendingRequest(requestId, socketId) {
  await Promise.all([
    pubClient.del(KEY.pendingReq(requestId)),
    socketId ? pubClient.srem(KEY.pendingReqs(socketId), requestId) : Promise.resolve(),
  ]);
}

async function setSocketRoom(socketId, roomId) {
  await pubClient.set(KEY.socketRoom(socketId), roomId, "EX", 86400);
}

async function getSocketRoom(socketId) {
  return pubClient.get(KEY.socketRoom(socketId));
}

async function clearSocketRoom(socketId) {
  await pubClient.del(KEY.socketRoom(socketId));
}

// ══════════════════════════════════════════
//  RATE LIMITER — Redis backed
// ══════════════════════════════════════════
const RATE_LIMITS = {
  "join-request":  { max: 5,  windowMs: 60_000 },
  "offer":         { max: 20, windowMs: 10_000 },
  "answer":        { max: 20, windowMs: 10_000 },
  "ice-candidate": { max: 60, windowMs: 10_000 },
};

async function checkLimit(socket, event) {
  const limit = RATE_LIMITS[event];
  if (!limit) return true;

  const key = KEY.rateLimiter(socket.id, event);
  const count = await pubClient.incr(key);

  if (count === 1) {
    await pubClient.pexpire(key, limit.windowMs);
  }

  if (count > limit.max) {
    console.warn(`🚫 Rate limit hit — socket ${socket.id} on "${event}" (${count}/${limit.max})`);
    socket.emit("rate-limited", { event, message: `Too many ${event} requests` });
    return false;
  }

  return true;
}

// ══════════════════════════════════════════
//  SOCKET.IO
// ══════════════════════════════════════════
io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id} (pid:${process.pid})`);

  socket.on("join-request", async ({ roomId, name }) => {
    if (!await checkLimit(socket, "join-request")) return;

    let host = await getHost(roomId);

    // ── Auto-heal stale host key ──────────────────────────────────
    // If stored host socket is no longer connected (e.g. server crashed
    // without clean disconnect), clear so next person becomes host
    // instead of waiting forever.
    if (host && !io.sockets.sockets.get(host)) {
      console.log(`⚠️  Stale host key for "${roomId}" (${host}) — auto-clearing`);
      await clearHost(roomId);
      host = null;
    }

    if (!host) {
      await admitToRoom(socket, roomId);
      return;
    }

    const requestId = `${socket.id}:${roomId}`;
    await setPendingRequest(requestId, { socketId: socket.id, roomId, name });
    socket.data.pendingRoom = roomId;

    io.to(host).emit("join-request", {
      requestId,
      peerId: socket.id,
      name: name ?? "Someone",
    });

    console.log(`⏳ ${socket.id} (${name}) waiting for host approval in "${roomId}"`);
  });

  socket.on("join-approve", async ({ requestId }) => {
    // ── Atomic Redis lock — prevents duplicate processing ─────────
    // NX = only set if key does Not eXist — exactly one server wins
    // even if host double-clicks or two servers race
    const locked = await pubClient.set(
      KEY.approveLock(requestId), "1", "EX", 10, "NX"
    );
    if (!locked) {
      console.log(`🔒 join-approve "${requestId}" already processed — ignoring duplicate`);
      return;
    }

    const req = await getPendingRequest(requestId);
    if (!req) return;

    await deletePendingRequest(requestId, req.socketId);
    console.log(`✅ Host approved ${req.socketId} for "${req.roomId}"`);

    const joinerSocket = io.sockets.sockets.get(req.socketId);

    if (joinerSocket) {
      await admitToRoom(joinerSocket, req.roomId);
    } else {
      // Joiner is on a different server — route via Redis adapter
      io.to(req.socketId).emit("join-admitted-internal", { roomId: req.roomId });
    }
  });

  // Cross-server admit — fires when host and joiner are on different servers
  socket.on("join-admitted-internal", async ({ roomId }) => {
    await admitToRoom(socket, roomId);
  });

  socket.on("join-reject", async ({ requestId }) => {
    const req = await getPendingRequest(requestId);
    if (!req) return;

    await deletePendingRequest(requestId, req.socketId);
    console.log(`❌ Host rejected ${req.socketId} for "${req.roomId}"`);
    io.to(req.socketId).emit("join-rejected", { roomId: req.roomId });
  });

  async function admitToRoom(sock, roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    const existingPeers = room ? [...room].filter(id => id !== sock.id) : [];
    const host = await getHost(roomId);
    const isHost = !host;

    sock.join(roomId);
    sock.data.roomId = roomId;
    await setSocketRoom(sock.id, roomId);

    if (isHost) await setHost(roomId, sock.id);

    sock.emit("role", { role: isHost ? "host" : "peer" });
    sock.emit("room-peers", { peers: existingPeers });
    sock.emit("join-admitted");

    console.log(`${isHost ? "👑 HOST" : "👤 PEER"} ${sock.id} admitted to "${roomId}" | peers: [${existingPeers.join(", ")}] (pid:${process.pid})`);

    existingPeers.forEach(id => io.to(id).emit("peer-joined", { peerId: sock.id }));
  }

  socket.on("offer", async ({ roomId, offer, targetId }) => {
    if (!await checkLimit(socket, "offer")) return;
    console.log(`📨 offer ${socket.id} → ${targetId}`);
    io.to(targetId).emit("offer", { offer, fromId: socket.id });
  });

  socket.on("answer", async ({ roomId, answer, targetId }) => {
    if (!await checkLimit(socket, "answer")) return;
    console.log(`📨 answer ${socket.id} → ${targetId}`);
    io.to(targetId).emit("answer", { answer, fromId: socket.id });
  });

  socket.on("ice-candidate", async ({ roomId, candidate, targetId }) => {
    if (!await checkLimit(socket, "ice-candidate")) return;
    io.to(targetId).emit("ice-candidate", { candidate, fromId: socket.id });
  });

  socket.on("disconnect", async () => {
    console.log(`❌ Disconnected: ${socket.id} (pid:${process.pid})`);
    const roomId = socket.data.roomId ?? await getSocketRoom(socket.id);

    if (roomId) {
      socket.to(roomId).emit("peer-left", { peerId: socket.id });

      const host = await getHost(roomId);
      if (host === socket.id) {
        await clearHost(roomId);
        console.log(`👑 Host ${socket.id} left "${roomId}" — host cleared`);
      }
    }

    await clearSocketRoom(socket.id);

    // O(1) cleanup using per-socket Set instead of keys() scan
    const setKey = KEY.pendingReqs(socket.id);
    const pendingIds = await pubClient.smembers(setKey);
    if (pendingIds.length) {
      await pubClient.del([
        setKey,
        ...pendingIds.map(id => KEY.pendingReq(id)),
      ]);
    }
  });
});

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => console.log(`🚀 Signaling server on :${PORT} (pid:${process.pid})`));