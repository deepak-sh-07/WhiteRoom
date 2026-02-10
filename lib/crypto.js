export async function generateRoomKey() {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
export async function exportKey(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return Array.from(new Uint8Array(raw));
}

export async function importKey(raw) {
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(raw),
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}
export async function encrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipher)),
  };
}

export async function decrypt(key, encrypted) {
  const { iv, cipher } = encrypted;

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(cipher)
  );

  return JSON.parse(new TextDecoder().decode(plain));
}
// ---------- RSA HELPERS (Week 4 – Phase 2) ----------

export async function generateRSAKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKey(key) {
  const spki = await crypto.subtle.exportKey("spki", key);
  return Array.from(new Uint8Array(spki));
}

export async function importPublicKey(raw) {
  return crypto.subtle.importKey(
    "spki",
    new Uint8Array(raw),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function encryptWithPublicKey(publicKey, data) {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encoded
  );
  return Array.from(new Uint8Array(cipher));
}

export async function decryptWithPrivateKey(privateKey, cipher) {
  const plain = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    new Uint8Array(cipher)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
