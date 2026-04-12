<div align="center">

<br />

```
██╗    ██╗██╗  ██╗██╗████████╗███████╗██████╗  ██████╗  ██████╗ ███╗   ███╗
██║    ██║██║  ██║██║╚══██╔══╝██╔════╝██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║
██║ █╗ ██║███████║██║   ██║   █████╗  ██████╔╝██║   ██║██║   ██║██╔████╔██║
██║███╗██║██╔══██║██║   ██║   ██╔══╝  ██╔══██╗██║   ██║██║   ██║██║╚██╔╝██║
╚███╔███╔╝██║  ██║██║   ██║   ███████╗██║  ██║╚██████╔╝╚██████╔╝██║ ╚═╝ ██║
 ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝     ╚═╝
```

**End-to-end encrypted collaborative rooms — video, whiteboard, docs, and AI.**

<br />

![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![Yjs](https://img.shields.io/badge/Yjs-4A90D9?style=for-the-badge&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![TipTap](https://img.shields.io/badge/TipTap-6366f1?style=for-the-badge&logoColor=white)
![tldraw](https://img.shields.io/badge/tldraw-ff4154?style=for-the-badge&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_AI-f55036?style=for-the-badge&logoColor=white)

<br />

</div>

---

## ✦ What is WhiteRoom?

WhiteRoom is a **privacy-first collaborative workspace** built for real-time sessions. Every room is ephemeral, every message is encrypted, and every peer connection is direct — no data ever passes through a central server in plaintext.

Think Google Meet × Notion × Miro, but everything is encrypted, offline-capable, and open.

---

## ✦ Features

### 🔐 Security-First Architecture
- **End-to-end encryption** on all data channel messages using AES-GCM symmetric keys
- **RSA key exchange** per peer — keys are negotiated directly between browsers, never touch the server
- **Waiting room** with host admit/deny — no one enters without explicit approval
- Zero plaintext content stored server-side

### 📹 Video Conferencing
- Multi-party WebRTC video with adaptive grid layout (1–6+ participants)
- Per-peer mic and camera toggles with live state sync
- Black track substitution for camera-off (no video track dropped, no reconnect needed)
- TURN server support for NAT traversal

### 🎨 Collaborative Whiteboard
- Powered by **tldraw** — full-featured drawing, shapes, arrows, text
- Real-time remote cursor overlay with participant names and colors
- Changes broadcast peer-to-peer over encrypted data channels

### 📝 Collaborative Document Editor
- Rich text editing via **TipTap** + **Yjs CRDT** — true conflict-free real-time collaboration
- Heading, bold, italic, code, blockquote, lists — full formatting toolbar
- Remote cursor rendering with live caret positions per collaborator
- **Snapshot history** — save named restore points to the database, restore or delete any time
- Y.UndoManager — per-user undo/redo that doesn't stomp on collaborators

### 🤖 AI Document Summary
- One-click AI summary of the current document via **Groq (Llama 3.3 70B)**
- Streaming response — tokens appear in real time as they're generated
- Structured output: Overview, Key Points, Action Items, Insights
- Slide-in panel with copy-to-clipboard and regenerate controls

### 💬 Encrypted Chat
- Per-session ephemeral chat — messages are encrypted in transit, never persisted
- Deduplication via stable message IDs across peers

### 🔄 Offline-First Sync
- **IndexedDB persistence** via `y-indexeddb` — docs and whiteboard survive refresh and tab close
- Offline banner with automatic state sync on reconnect
- Full Yjs state broadcast to late-joining peers on handshake

### 👥 Presence & Awareness
- Live presence sidebar with per-user mic/camera status
- Cursor positions broadcast via Yjs Awareness protocol
- Heartbeat awareness updates every 30 seconds

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Realtime signaling | Express + Socket.io |
| P2P transport | WebRTC (RTCPeerConnection + DataChannel) |
| CRDT sync | Yjs + y-indexeddb |
| Document editor | TipTap + @tiptap/extension-collaboration |
| Whiteboard | tldraw |
| Encryption | Web Crypto API (AES-GCM + RSA-OAEP) |
| AI | Groq SDK (Llama 3.3 70B) |
| Animations | Framer Motion |
| Styling | Tailwind CSS + inline styles |

---

## ✦ Project Structure

```
whiteroom/
├── app/                              # Next.js App Router
│   ├── api/                          # Serverless API routes
│   │   ├── summarize/
│   │   │   └── route.js              # AI summary endpoint (Groq streaming)
│   │   ├── snapshots/
│   │   │   └── route.js              # Snapshot save / load / delete
│   │   └── turn/
│   │       └── route.js              # TURN server credentials
│   ├── create/                       # Create a new room
│   │   └── page.js
│   ├── join/                         # Join an existing room by code
│   │   └── page.js
│   ├── login/                        # Auth / username entry
│   │   └── page.js
│   ├── room/
│   │   └── [roomId]/
│   │       └── page.jsx              # Main room — WebRTC, Yjs, socket wiring
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.js                     # Root layout + font imports
│   └── page.js                       # Landing page
│
├── Backend/                          # Express + Socket.io signaling server
│   └── index.js                      # Rooms, waiting queue, relay signaling
│
├── components/                       # Shared React components
│   ├── AISummaryPanel.jsx            # Streaming AI summary slide-in panel
│   ├── ChatPanel.jsx                 # Encrypted ephemeral chat
│   ├── ControlBar.jsx                # Mic / camera / leave controls
│   ├── DocsPanel.jsx                 # TipTap collaborative rich-text editor
│   ├── LogoutButton.jsx              # Session logout
│   ├── PresenceSidebar.jsx           # Live user list with mic/camera state
│   ├── StatusBadge.jsx               # Online / offline indicator
│   ├── VideoTile.jsx                 # Single participant video tile
│   ├── ViewSwitcher.jsx              # Video / Whiteboard / Docs tab bar
│   └── WhiteboardPanel.jsx           # tldraw whiteboard + cursor overlay
│
├── lib/                              # Shared utilities
│   ├── crypto.js                     # AES-GCM + RSA-OAEP Web Crypto helpers
│   ├── socket.js                     # Socket.io client singleton
│   └── sounds.js                     # Join / leave / knock audio
│
├── prisma/                           # Database schema + migrations
│   └── schema.prisma                 # Snapshot model
│
└── public/                           # Static assets
```

---

## ✦ Getting Started

### Prerequisites

- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier available)
- Optional: TURN server credentials for production NAT traversal

### Installation

```bash
git clone https://github.com/your-username/whiteroom
cd whiteroom
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Required — AI summarization
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Optional — TURN server for production WebRTC
TURN_URL=turn:your-turn-server.com:3478
TURN_USERNAME=your_username
TURN_CREDENTIAL=your_credential

# Optional — database for snapshot persistence
DATABASE_URL=your_database_url
```

### Development

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — Socket.io signaling server
node server/index.js
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
npm run build
npm start
```

> Make sure your signaling server is deployed and `NEXT_PUBLIC_SOCKET_URL` points to it.

---

## ✦ How It Works

### Connection Flow

```
Browser A                    Signaling Server              Browser B
    │                              │                            │
    ├─── join-request ────────────►│                            │
    │◄── join-admitted ────────────┤                            │
    │                              │◄─── join-request ──────────┤
    │◄── room-peers ───────────────┤                            │
    │                              │                            │
    ├─── offer ───────────────────►│─── offer ─────────────────►│
    │◄── answer ───────────────────┤◄── answer ─────────────────┤
    │◄──────────── ICE candidates ─┼────────────────────────────►│
    │                              │                            │
    │◄═══════════ Direct P2P DataChannel (encrypted) ══════════►│
    │◄═══════════ Direct P2P VideoTrack (WebRTC)    ══════════►│
```

### Encryption Flow

```
Peer A opens DataChannel
    │
    ├─ Generates AES-GCM room key + RSA keypair
    ├─ Sends RSA public key to Peer B
    │
Peer B receives PUBLIC_KEY
    ├─ If socket.id < peerId: encrypts AES key with B's RSA public key
    └─ Sends SET_KEY_SECURE back to A
    │
Both peers now share the same AES-GCM key
All subsequent messages: encrypt(key, payload) → decrypt(key, payload)
```

### Offline Sync

Docs and whiteboard state live in a **Yjs document** persisted to IndexedDB. On reconnect or when a new peer joins, the full Yjs state vector is encrypted and sent over the data channel — both peers converge automatically via CRDT merge.

Chat is intentionally **ephemeral** — it exists only in React state for the duration of the session.

---

## ✦ AI Summary

The AI summary feature reads the current document content directly from the Yjs `tiptap-doc` XML fragment, extracts plain text, and streams a structured summary from **Groq's Llama 3.3 70B** model via SSE.

```
Click "AI Summary"
    │
    ├─ AISummaryPanel extracts text from Y.XmlFragment("tiptap-doc")
    ├─ POST /api/summarize { docsText }
    │
    └─ Server streams SSE tokens via Groq SDK
           │
           ▼
    Panel renders markdown in real time as tokens arrive
```

The summary is structured into four sections when content warrants:
- **📋 Overview** — core topic in 1–2 sentences
- **🔑 Key Points** — bullet list of important ideas
- **✅ Action Items** — tasks and follow-ups
- **💡 Insights** — patterns and open questions

---

## ✦ Snapshot System

The document editor supports named snapshots stored in the database. Each snapshot captures the full Yjs document state as a base64-encoded binary blob. Restoring a snapshot applies the state transactionally — existing content is cleared and replaced cleanly without CRDT merge conflicts.

---

## ✦ Contributing

Pull requests are welcome. For major changes please open an issue first.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push and open a PR

---

## ✦ License

MIT © WhiteRoom

---

<div align="center">
<br />
Built with WebRTC · Yjs · TipTap · tldraw · Groq
<br /><br />
<i>Everything is encrypted. Nothing is stored. All of it is live.</i>
</div>
