/**
 * Standardized error codes for user-facing errors.
 * Used by the bug report system to categorize tickets.
 * Must stay in sync with VALID_ERROR_CODES in worker/src/shared-validation.ts.
 */
export const ERROR_CODES = {
  // Messaging
  SEND_MSG_FAILED: "send-msg-failed",
  DECRYPT_MSG_FAILED: "decrypt-msg-failed",
  MEDIA_UPLOAD_FAILED: "media-upload-failed",
  REACTION_FAILED: "reaction-failed",

  // Auth / Identity
  AUTH_DERIVED_KEY: "auth-derived-key",
  AUTH_POPUP_BLOCKED: "auth-popup-blocked",
  AUTH_SNAPSHOT_FAILED: "auth-snapshot-failed",

  // Groups
  GROUP_CREATE_FAILED: "group-create-failed",
  GROUP_JOIN_FAILED: "group-join-failed",
  GROUP_MEMBER_ADD_FAILED: "group-member-add-failed",

  // Transactions
  TIP_FAILED: "tip-failed",
  ASSOCIATION_FAILED: "association-failed",
  INSUFFICIENT_BALANCE: "insufficient-balance",

  // Network / Worker
  WS_CONNECTION_FAILED: "ws-connection-failed",
  PUSH_SUBSCRIBE_FAILED: "push-subscribe-failed",
  API_TIMEOUT: "api-timeout",

  // UI
  CHUNK_LOAD_FAILED: "chunk-load-failed",
  RENDER_ERROR: "render-error",

  // Catch-all
  UNKNOWN: "unknown",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
