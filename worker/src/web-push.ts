/**
 * Minimal Web Push sender for Cloudflare Workers.
 * Implements RFC 8291 (Message Encryption) + RFC 8292 (VAPID).
 * Uses only Web Crypto API — no Node.js dependencies.
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string }; // base64url
}

// ── Base64url ──

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ── VAPID private key import ──

function buildPkcs8(rawPrivate: Uint8Array): Uint8Array {
  // PKCS#8 wrapping for a 32-byte EC P-256 private key (no public key section)
  return new Uint8Array([
    0x30, 0x41,                                                   // SEQUENCE (65 bytes)
    0x02, 0x01, 0x00,                                             // INTEGER 0 (version)
    0x30, 0x13,                                                   // SEQUENCE (19 bytes) AlgorithmIdentifier
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,       // OID ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID prime256v1
    0x04, 0x27,                                                   // OCTET STRING (39 bytes)
    0x30, 0x25,                                                   // SEQUENCE (37 bytes) ECPrivateKey
    0x02, 0x01, 0x01,                                             // INTEGER 1
    0x04, 0x20,                                                   // OCTET STRING (32 bytes)
    ...rawPrivate,
  ]);
}

async function importVapidPrivateKey(base64urlKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(unb64url(base64urlKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    true, // exportable so we can get x,y for the public key
    ["sign"]
  );
}

async function getVapidPublicKeyBytes(privateKey: CryptoKey): Promise<Uint8Array> {
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  if (!jwk.x || !jwk.y) throw new Error("Cannot export public key from VAPID key");
  return concat(new Uint8Array([0x04]), unb64url(jwk.x), unb64url(jwk.y));
}

// ── VAPID JWT (ES256) ──

async function createVapidAuth(
  endpoint: string,
  privateKey: CryptoKey,
  subject: string
): Promise<{ authorization: string; vapidPublicKey: Uint8Array }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const enc = new TextEncoder();

  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));

  const token = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(token))
  );

  const vapidPublicKey = await getVapidPublicKeyBytes(privateKey);
  return {
    authorization: `vapid t=${token}.${b64url(sig)}, k=${b64url(vapidPublicKey)}`,
    vapidPublicKey,
  };
}

// ── HKDF (extract + expand via Web Crypto) ──

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info },
      baseKey,
      length * 8
    )
  );
}

// ── Payload encryption (RFC 8291 + RFC 8188 aes128gcm) ──

async function encrypt(
  payload: string,
  uaPublic: Uint8Array, // subscriber's p256dh (65 bytes uncompressed)
  authSecret: Uint8Array // subscriber's auth (16 bytes)
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Ephemeral ECDH key pair (application server key for this message)
  const asKey = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKey.publicKey));

  // Import subscriber's public key for ECDH
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);

  // Shared secret via ECDH
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKey.privateKey, 256)
  );

  // IKM = HKDF(salt=authSecret, ikm=ecdhSecret, info="WebPush: info\0" || uaPublic || asPublic, 32)
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // CEK = HKDF(salt=salt, ikm=IKM, info="Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);

  // Nonce = HKDF(salt=salt, ikm=IKM, info="Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // Pad: plaintext || 0x02 (delimiter)
  const padded = concat(enc.encode(payload), new Uint8Array([2]));

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );

  // aes128gcm header: salt(16) || rs(4, uint32 BE) || idlen(1) || keyid(65 = asPublic)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  return concat(salt, rs, new Uint8Array([65]), asPublic, ciphertext);
}

// ── Public API ──

/**
 * Derive a Topic header value (max 32 chars, base64url) from a conversation key.
 * Push services replace queued messages with the same Topic, so multiple messages
 * to the same conversation collapse into one notification while offline.
 */
async function deriveTopic(conversationKey: string): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(conversationKey))
  );
  // Use first 24 bytes → 32 base64url chars (max allowed by RFC 8030)
  return b64url(hash.slice(0, 24));
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: { title: string; body: string; tag?: string; conversationKey?: string; from?: string },
  vapidPrivateKeyBase64url: string,
  vapidSubject: string
): Promise<"sent" | "expired" | "error"> {
  try {
    const privateKey = await importVapidPrivateKey(vapidPrivateKeyBase64url);
    const { authorization } = await createVapidAuth(subscription.endpoint, privateKey, vapidSubject);

    const body = await encrypt(
      JSON.stringify(payload),
      unb64url(subscription.keys.p256dh),
      unb64url(subscription.keys.auth)
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(body.length),
      Authorization: authorization,
      TTL: "604800", // 7 days — ensures offline devices receive notifications
      Urgency: "high",
    };

    // Topic header: push services replace queued messages with the same Topic,
    // so multiple messages to the same conversation produce one notification.
    if (payload.conversationKey) {
      headers["Topic"] = await deriveTopic(payload.conversationKey);
    }

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers,
      body,
    });

    if (res.status === 410 || res.status === 404) return "expired";
    if (res.status >= 200 && res.status < 300) return "sent";
    return "error";
  } catch (e) {
    console.error("Push send failed:", e);
    return "error";
  }
}
