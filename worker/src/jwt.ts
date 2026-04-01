/**
 * DeSo JWT validation.
 *
 * Validates a JWT by calling the DeSo node's validate-jwt endpoint.
 * This confirms the JWT was signed by the claimed public key (or an
 * authorized derived key), without us needing to do the ES256 crypto
 * ourselves.
 */

interface ValidateJwtResponse {
  IsValid: boolean;
}

/**
 * Validate a DeSo JWT against the given public key.
 * Returns `true` if the JWT was signed by (a derived key of) the
 * claimed public key and has not expired.
 */
export async function validateDesoJwt(
  nodeUrl: string,
  publicKey: string,
  jwt: string
): Promise<boolean> {
  try {
    const res = await fetch(`${nodeUrl}/api/v0/validate-jwt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        PublicKeyBase58Check: publicKey,
        JWT: jwt,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as ValidateJwtResponse;
    return data.IsValid === true;
  } catch {
    return false;
  }
}
