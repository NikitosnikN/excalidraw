const textEncoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const generateRoomId = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `room_${toBase64Url(bytes)}`;
};

export const generateAccessToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `sat_${toBase64Url(bytes)}`;
};

export const hashAccessToken = async (token: string, pepper: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(token),
  );
  return `hmac-sha256:${toBase64Url(new Uint8Array(signature))}`;
};

export const timingSafeEqual = (left: string, right: string) => {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  let diff = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index++) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
};
