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
