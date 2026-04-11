/**
 * Test: Can an atomic-wrapped (payment + DM message) be indexed by the
 * DeSo node so it shows up in the recipient's inbox?
 *
 * Uses testnet keys from .env.development.
 *
 * Run: node scripts/test-atomic-message.mjs
 */

import { sha256 } from "@noble/hashes/sha256";
import {
  sign as ecSign,
  getPublicKey,
  utils as ecUtils,
} from "@noble/secp256k1";
import { signTx } from "deso-protocol/src/identity/crypto-utils.js";
import { readFileSync } from "fs";
import bs58 from "bs58";

// ── Load env ──
const env = Object.fromEntries(
  readFileSync(".env.development", "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      return [k.trim(), rest.join("=").trim().replace(/^"|"$/g, "")];
    })
);

const NODE_URL = "https://test.deso.org";
const PK1 = env.TESTNET_PUBLIC_KEY_1;
const SEED1 = env.TESTNET_SEEDHEX_1;
const PK2 = env.TESTNET_PUBLIC_KEY_2;
const SEED2 = env.TESTNET_SEEDHEX_2;

console.log("=== Atomic Message Indexing Test ===\n");
console.log("Testnet node:", NODE_URL);
console.log("Sender (key1):", PK1);
console.log("Recipient (key2):", PK2);
console.log("");

// ── Base58Check encoding (DeSo testnet format) ──

const TESTNET_PREFIX = (() => {
  const decoded = bs58.decode(PK1);
  return decoded.slice(0, decoded.length - 33 - 4);
})();

function publicKeyToBase58Check(compressedPubKeyBytes) {
  const payload = new Uint8Array([...TESTNET_PREFIX, ...compressedPubKeyBytes]);
  const checksum = sha256(sha256(payload)).slice(0, 4);
  return bs58.encode(new Uint8Array([...payload, ...checksum]));
}

function seedHexToPublicKeyBase58(seedHex) {
  const pubKey = getPublicKey(ecUtils.hexToBytes(seedHex), true);
  return publicKeyToBase58Check(pubKey);
}

// ── Helpers ──

function sha256x2(data) {
  return sha256(sha256(data));
}

async function signTransaction(txHex, seedHex) {
  const txBytes = ecUtils.hexToBytes(txHex);
  const hash = sha256x2(txBytes);
  const sig = await ecSign(ecUtils.bytesToHex(hash), ecUtils.hexToBytes(seedHex), {
    canonical: true, der: true, extraEntropy: true, recovered: true,
  });
  return ecUtils.bytesToHex(sig[0]);
}

async function post(endpoint, body) {
  const url = `${NODE_URL}/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} failed (${res.status}): ${text}`);
  return JSON.parse(text);
}

async function submitSigned(txHex, seedHex) {
  const sig = await signTransaction(txHex, seedHex);
  return post("api/v0/submit-transaction", {
    UnsignedTransactionHex: txHex,
    TransactionSignatureHex: sig,
  });
}

// ── Step 0: Ensure access groups exist ──

async function ensureAccessGroup(pk, seedHex, label) {
  console.log(`Checking access group for ${label} (${pk.slice(0, 16)}...)...`);

  const checkRes = await post("api/v0/check-party-access-groups", {
    SenderPublicKeyBase58Check: pk,
    SenderAccessGroupKeyName: "default-key",
    RecipientPublicKeyBase58Check: pk,
    RecipientAccessGroupKeyName: "default-key",
  });

  if (checkRes.IsSenderAccessGroupKey) {
    console.log(`  ✓ Access group exists`);
    return;
  }

  console.log(`  Creating default-key access group...`);
  const derivedSeed = ecUtils.bytesToHex(sha256(ecUtils.hexToBytes(seedHex)));
  const accessGroupPubKey = seedHexToPublicKeyBase58(derivedSeed);

  const constructRes = await post("api/v0/create-access-group", {
    AccessGroupOwnerPublicKeyBase58Check: pk,
    AccessGroupKeyName: "default-key",
    AccessGroupPublicKeyBase58Check: accessGroupPubKey,
    MinFeeRateNanosPerKB: 1000,
  });

  const result = await submitSigned(constructRes.TransactionHex, seedHex);
  console.log(`  ✓ Created. TxHash: ${result.TxnHashHex}`);
  console.log("  Waiting 3s for indexing...");
  await new Promise((r) => setTimeout(r, 3000));
}

// ── Build message body ──

let partyInfo = null;

async function checkPartyGroups() {
  console.log("\nChecking party access groups (PK1 → PK2)...");
  partyInfo = await post("api/v0/check-party-access-groups", {
    SenderPublicKeyBase58Check: PK1,
    SenderAccessGroupKeyName: "default-key",
    RecipientPublicKeyBase58Check: PK2,
    RecipientAccessGroupKeyName: "default-key",
  });
  console.log("Both parties have access groups:", partyInfo.IsSenderAccessGroupKey && partyInfo.IsRecipientAccessGroupKey);
}

function buildMsgBody(text, extraExtraData = {}) {
  const msgHex = ecUtils.bytesToHex(new TextEncoder().encode(text));
  return {
    SenderAccessGroupOwnerPublicKeyBase58Check: PK1,
    SenderAccessGroupPublicKeyBase58Check:
      partyInfo.SenderAccessGroupPublicKeyBase58Check || PK1,
    SenderAccessGroupKeyName: partyInfo.SenderAccessGroupKeyName || "default-key",
    RecipientAccessGroupOwnerPublicKeyBase58Check: PK2,
    RecipientAccessGroupPublicKeyBase58Check:
      partyInfo.RecipientAccessGroupPublicKeyBase58Check || PK2,
    RecipientAccessGroupKeyName:
      partyInfo.RecipientAccessGroupKeyName || "default-key",
    EncryptedMessageText: msgHex,
    ExtraData: { unencrypted: "true", "msg:type": "text", ...extraExtraData },
    MinFeeRateNanosPerKB: 1000,
  };
}

// ── Test A: Normal standalone message ──

async function sendNormalMessage(text) {
  console.log(`\n--- Test A: Normal standalone message ---`);
  console.log(`Sending: "${text}"`);

  const constructRes = await post(
    "api/v0/send-dm-message",
    buildMsgBody(text, { "test:id": "normal-baseline" })
  );

  const result = await submitSigned(constructRes.TransactionHex, SEED1);
  console.log(`✓ Normal message sent. TxHash: ${result.TxnHashHex}`);
  return result.TxnHashHex;
}

// ── Test B: Atomic payment + message ──

async function sendAtomicPaymentMessage(text) {
  console.log(`\n--- Test B: Atomic payment + message ---`);
  console.log(`Sending: "${text}" with 1000 nano payment`);

  // 1. Construct payment
  const paymentRes = await post("api/v0/send-deso", {
    SenderPublicKeyBase58Check: PK1,
    RecipientPublicKeyOrUsername: PK2,
    AmountNanos: 1000,
    MinFeeRateNanosPerKB: 1000,
  });
  console.log("✓ Payment transaction constructed");

  // 2. Construct message
  const msgRes = await post(
    "api/v0/send-dm-message",
    buildMsgBody(text, {
      "test:id": "atomic-paid",
      "msg:paidDm": "true",
      "msg:paidAmount": "1000",
      "msg:paidCurrency": "DESO",
    })
  );
  console.log("✓ Message transaction constructed");

  // 3. Bundle atomically
  const atomicRes = await post("api/v0/create-atomic-txns-wrapper", {
    UnsignedTransactionHexes: [
      paymentRes.TransactionHex,
      msgRes.TransactionHex,
    ],
  });
  console.log("✓ Atomic wrapper created");
  console.log(`  InnerTransactionHexes count: ${atomicRes.InnerTransactionHexes?.length}`);

  // 4. Sign each inner transaction individually using the DeSo SDK's signTx
  //    (embeds signature into the transaction bytes — required for atomic submit)
  const signedInnerTxns = [];
  for (const innerTxHex of atomicRes.InnerTransactionHexes) {
    const signedHex = await signTx(innerTxHex, SEED1);
    signedInnerTxns.push(signedHex);
  }
  console.log(`✓ Signed ${signedInnerTxns.length} inner transactions`);

  // 5. Submit via atomic endpoint (wrapper is unsigned, inners are signed)
  const result = await post("api/v0/submit-atomic-transaction", {
    IncompleteAtomicTransactionHex: atomicRes.TransactionHex,
    SignedInnerTransactionsHex: signedInnerTxns,
  });
  console.log(`✓ Atomic transaction submitted. TxHash: ${result.TxnHashHex}`);
  return result.TxnHashHex;
}

// ── Check if messages appear in recipient's inbox ──

async function checkInbox() {
  console.log(`\n--- Checking recipient's inbox ---`);

  const threads = await post(
    "api/v0/get-user-dm-threads-ordered-by-timestamp",
    { UserPublicKeyBase58Check: PK2 }
  );

  if (!threads.DmThreads || threads.DmThreads.length === 0) {
    console.log("No DM threads found for recipient");
    return { foundNormal: false, foundAtomic: false };
  }

  console.log(`Found ${threads.DmThreads.length} DM thread(s)`);

  const messages = await post(
    "api/v0/get-paginated-messages-for-dm-thread",
    {
      UserGroupOwnerPublicKeyBase58Check: PK2,
      UserGroupKeyName: "default-key",
      PartyGroupOwnerPublicKeyBase58Check: PK1,
      PartyGroupKeyName: "default-key",
      StartTimestampString: "",
      MaxMessagesToFetch: 20,
    }
  );

  if (!messages.ThreadMessages || messages.ThreadMessages.length === 0) {
    console.log("No messages found in thread with sender");
    return { foundNormal: false, foundAtomic: false };
  }

  console.log(`\nFound ${messages.ThreadMessages.length} message(s) in thread:\n`);

  let foundNormal = false;
  let foundAtomic = false;

  for (const msg of messages.ThreadMessages) {
    const extra = msg.MessageInfo?.ExtraData || {};
    const testId = extra["test:id"] || "unknown";
    const isPaid = extra["msg:paidDm"] === "true";

    if (testId === "normal-baseline") foundNormal = true;
    if (testId === "atomic-paid") foundAtomic = true;

    let decoded = "(encrypted)";
    if (extra["unencrypted"] === "true" && msg.MessageInfo?.EncryptedText) {
      try {
        decoded = new TextDecoder().decode(
          ecUtils.hexToBytes(msg.MessageInfo.EncryptedText)
        );
      } catch {
        decoded = "(decode failed)";
      }
    }

    const sender = msg.MessageInfo?.SenderInfo?.OwnerPublicKeyBase58Check?.slice(0, 16) || "?";
    console.log(`  [${testId}] sender=${sender}... paid=${isPaid}`);
    console.log(`    text: "${decoded}"`);
    console.log("");
  }

  return { foundNormal, foundAtomic };
}

// ── Main ──

async function main() {
  try {
    // Verify key derivation
    const derivedPK1 = seedHexToPublicKeyBase58(SEED1);
    console.log(`Key derivation check: ${derivedPK1 === PK1 ? "✓ match" : "✗ MISMATCH"}\n`);

    // Step 0: Ensure both users have access groups
    await ensureAccessGroup(PK1, SEED1, "key1");
    await ensureAccessGroup(PK2, SEED2, "key2");
    await checkPartyGroups();

    // Step 1: Normal message (baseline)
    const normalTxHash = await sendNormalMessage(
      `Normal test message ${Date.now()}`
    );

    console.log("\nWaiting 5s for indexing...");
    await new Promise((r) => setTimeout(r, 5000));

    // Step 2: Atomic payment + message
    const atomicTxHash = await sendAtomicPaymentMessage(
      `Atomic paid message ${Date.now()}`
    );

    console.log("\nWaiting 8s for indexing...");
    await new Promise((r) => setTimeout(r, 8000));

    // Step 3: Check inbox
    const results = await checkInbox();

    // Summary
    console.log("═══════════════════════════════════════════");
    console.log("              RESULTS");
    console.log("═══════════════════════════════════════════");
    console.log(`Normal message TxHash:  ${normalTxHash}`);
    console.log(`Atomic message TxHash:  ${atomicTxHash}`);
    console.log("");
    console.log(`Normal message indexed:  ${results.foundNormal ? "✓ YES" : "✗ NO"}`);
    console.log(`Atomic message indexed:  ${results.foundAtomic ? "✓ YES" : "✗ NO"}`);
    console.log("");
    if (results.foundAtomic) {
      console.log("ATOMIC MESSAGES ARE INDEXED!");
      console.log("Per-message payment via atomic bundling is viable.");
    } else if (results.foundNormal) {
      console.log("Atomic messages are NOT indexed.");
      console.log("Must use sequential fallback (payment first, then message).");
    } else {
      console.log("Neither message found — indexing may be delayed.");
      console.log("Re-run just the inbox check after a minute.");
    }
  } catch (err) {
    console.error("\n✗ Test failed:", err.message || err);
  }
}

main();
