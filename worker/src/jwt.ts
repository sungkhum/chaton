/**
 * DeSo JWT validation.
 *
 * Verifies JWTs locally using secp256k1 signature verification, then
 * confirms the derived key is authorized for the claimed owner via the
 * DeSo node's get-user-derived-keys endpoint.
 *
 * DeSo JWTs are signed by the user's derived key (not the owner key).
 * The payload contains { derivedPublicKeyBase58Check, iat, exp }.
 * The signature is ECDSA secp256k1 over SHA256(header.payload).
 */

import { sha256 } from "@noble/hashes/sha256";
import { verify as ecVerify, utils as ecUtils } from "@noble/secp256k1";
import bs58 from "bs58";

/** DeSo mainnet public key prefix bytes. */
const DESO_MAINNET_PREFIX = new Uint8Array([0xcd, 0x14, 0x00]);

interface JwtPayload {
  derivedPublicKeyBase58Check?: string;
  iat: number;
  exp: number;
}

interface DerivedKeyEntry {
  DerivedPublicKeyBase58Check: string;
  IsValid: boolean;
}

interface GetDerivedKeysResponse {
  DerivedKeys: Record<string, DerivedKeyEntry>;
}

// ── Helpers ──

function base64UrlDecode(str: string): Uint8Array {
  // Restore base64 padding and standard chars
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Decode a DeSo base58check public key to raw compressed bytes (33 bytes).
 * Strips the 3-byte network prefix and 4-byte checksum.
 */
function desoPublicKeyToBytes(base58Key: string): Uint8Array {
  const decoded = bs58.decode(base58Key);
  // decoded = 3-byte prefix + 33-byte pubkey + 4-byte checksum
  return decoded.slice(DESO_MAINNET_PREFIX.length, decoded.length - 4);
}

/**
 * Convert a JOSE/compact signature (64 bytes: r || s) to DER encoding
 * so noble-secp256k1 can parse it.
 */
function joseSignatureToDer(sig: Uint8Array): Uint8Array {
  const r = sig.slice(0, 32);
  const s = sig.slice(32, 64);

  // DER integer encoding: strip leading zeros, add 0x00 pad if high bit set
  function derInt(bytes: Uint8Array): Uint8Array {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    const needsPad = trimmed[0] >= 0x80;
    const result = new Uint8Array(trimmed.length + (needsPad ? 1 : 0));
    if (needsPad) result[0] = 0x00;
    result.set(trimmed, needsPad ? 1 : 0);
    return result;
  }

  const rDer = derInt(r);
  const sDer = derInt(s);

  // SEQUENCE(INTEGER(r), INTEGER(s))
  const totalLen = 2 + rDer.length + 2 + sDer.length;
  const der = new Uint8Array(2 + totalLen);
  let offset = 0;
  der[offset++] = 0x30; // SEQUENCE
  der[offset++] = totalLen;
  der[offset++] = 0x02; // INTEGER
  der[offset++] = rDer.length;
  der.set(rDer, offset);
  offset += rDer.length;
  der[offset++] = 0x02; // INTEGER
  der[offset++] = sDer.length;
  der.set(sDer, offset);
  return der;
}

// ── Main validation ──

/**
 * Validate a DeSo JWT against the given owner public key.
 *
 * 1. Parses the JWT and checks expiration.
 * 2. Verifies the secp256k1 signature against the derived public key.
 * 3. Confirms the derived key is authorized for the owner via the DeSo node.
 */
export async function validateDesoJwt(
  nodeUrl: string,
  ownerPublicKey: string,
  jwt: string
): Promise<boolean> {
  try {
    // 1. Parse JWT
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      console.error("[jwt] malformed JWT: expected 3 parts");
      return false;
    }

    const payloadJson = new TextDecoder().decode(base64UrlDecode(parts[1]));
    const payload: JwtPayload = JSON.parse(payloadJson);

    // 2. Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      console.error("[jwt] JWT expired");
      return false;
    }

    // 3. Verify signature
    const { derivedPublicKeyBase58Check } = payload;
    if (!derivedPublicKeyBase58Check) {
      console.error("[jwt] JWT missing derivedPublicKeyBase58Check");
      return false;
    }

    const signingInput = `${parts[0]}.${parts[1]}`;
    const msgHash = sha256(new TextEncoder().encode(signingInput));
    const sigBytes = base64UrlDecode(parts[2]);
    const derSig = joseSignatureToDer(sigBytes);
    const pubKeyBytes = desoPublicKeyToBytes(derivedPublicKeyBase58Check);

    const valid = ecVerify(derSig, msgHash, pubKeyBytes);
    if (!valid) {
      console.error("[jwt] signature verification failed");
      return false;
    }

    // 4. Verify derived key is authorized for the owner
    const authorized = await isDerivedKeyAuthorized(
      nodeUrl,
      ownerPublicKey,
      derivedPublicKeyBase58Check
    );
    if (!authorized) {
      console.error(
        `[jwt] derived key ${derivedPublicKeyBase58Check} not authorized for ${ownerPublicKey}`
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error("[jwt] validation error:", err);
    return false;
  }
}

/**
 * Check if a derived key is authorized for an owner via the DeSo node.
 */
async function isDerivedKeyAuthorized(
  nodeUrl: string,
  ownerPublicKey: string,
  derivedPublicKey: string
): Promise<boolean> {
  try {
    const res = await fetch(`${nodeUrl}/api/v0/get-user-derived-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        PublicKeyBase58Check: ownerPublicKey,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as GetDerivedKeysResponse;
    const entry = data.DerivedKeys?.[derivedPublicKey];
    return entry?.IsValid === true;
  } catch {
    return false;
  }
}
