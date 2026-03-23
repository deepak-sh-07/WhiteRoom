// lib/sounds.js
// Uses mp3 files from /public/sounds/

function play(file) {
  if (typeof window === "undefined") return;
  const audio = new Audio(`/sounds/${file}`);
  audio.volume = 0.5;
  audio.play().catch(() => {}); // silently ignore if blocked
}

// You joined the room
export function playJoinSound() {
  play("join.mp3");
}

// You left the room
export function playLeaveSound() {
  play("exit.mp3");
}

// Host hears this when someone requests to join
export function playKnockSound() {
  play("wait.mp3");
}

// No-op — no longer needed, kept for import compatibility
export function unlockAudio() {}