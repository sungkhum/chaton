# Repo Map (generated 2026-04-26)
# Compact codebase index for AI agents. Read this FIRST, then do targeted file reads.

## Routes
<!-- route → Component → file -->
/privacy → LegalPage → src/components/legal-page.tsx
/terms → LegalPage → src/components/legal-page.tsx
/donate → SupportPage → src/components/support-page.tsx
/community → CommunityPage → src/components/community-page.tsx
/faq → FaqPage → src/components/faq-page.tsx
/about → AboutPage → src/components/about-page.tsx
/compare → ComparePage → src/components/compare-page.tsx
/blog → BlogIndex → ?
/blog/* → PostComponent → ?
(authenticated) → MessagingApp → src/components/messaging-app.tsx

## Error Codes
<!-- When a ticket has an error_code, find it here to know where to look -->
# Messaging
send-msg-failed (SEND_MSG_FAILED)
decrypt-msg-failed (DECRYPT_MSG_FAILED)
media-upload-failed (MEDIA_UPLOAD_FAILED) → src/components/send-message-button-and-input.tsx
reaction-failed (REACTION_FAILED)
# Auth / Identity
auth-derived-key (AUTH_DERIVED_KEY)
auth-popup-blocked (AUTH_POPUP_BLOCKED)
auth-snapshot-failed (AUTH_SNAPSHOT_FAILED)
# Groups
group-create-failed (GROUP_CREATE_FAILED)
group-join-failed (GROUP_JOIN_FAILED)
group-member-add-failed (GROUP_MEMBER_ADD_FAILED)
# Transactions
tip-failed (TIP_FAILED)
association-failed (ASSOCIATION_FAILED)
insufficient-balance (INSUFFICIENT_BALANCE)
# Network / Worker
ws-connection-failed (WS_CONNECTION_FAILED)
push-subscribe-failed (PUSH_SUBSCRIBE_FAILED)
api-timeout (API_TIMEOUT)
# UI
chunk-load-failed (CHUNK_LOAD_FAILED) → src/components/route-error-boundary.tsx
render-error (RENDER_ERROR) → src/components/route-error-boundary.tsx
# Catch-all
unknown (UNKNOWN) → src/components/manage-members-dialog.tsx, src/hooks/useInstallPrompt.ts, src/hooks/usePresence.ts, src/services/ticket.service.ts, src/utils/error-capture.ts

## Entry Points
src/App.tsx — Root app component, route switching, auth flow
src/main.tsx — React entry point, renders App
src/sw.ts — Service worker (push notifications, caching)
src/store/index.ts — Zustand store: AppUser, MessageStatus, useStore

## Components
src/components/about-page.tsx  AboutPage
src/components/archive-confirm-modal.tsx  fn ArchiveConfirmModal
src/components/blog/blog-index.tsx  BlogIndex
src/components/blog/blog-post-layout.tsx  BlogPostLayout
src/components/blog/blog-registry.ts  fn getBlogSlugs, getPostBySlug, lazyPost
src/components/blog/posts/best-decentralized-messaging-apps-2026.tsx
src/components/blog/posts/chaton-vs-signal.tsx
src/components/blog/posts/chaton-vs-telegram.tsx
src/components/blog/posts/how-to-create-a-group-chat.tsx
src/components/blog/posts/near-zero-infrastructure.tsx
src/components/blog/posts/what-is-end-to-end-encryption.tsx
src/components/bug-report-modal.tsx  fn BugReportModal
src/components/community-page.tsx
src/components/community-tab.tsx
src/components/compare-page.tsx  ComparePage
src/components/compose-panel.tsx
src/components/compose/audio-recorder-panel.tsx  AudioRecorderPanel
src/components/compose/emoji-picker-button.tsx  EmojiPickerButton
src/components/compose/full-emoji-picker.tsx  fn FullEmojiPicker
src/components/compose/gif-picker.tsx  GifPicker
src/components/compose/image-preview-panel.tsx  ImagePreviewPanel
src/components/compose/link-attachment-panel.tsx  LinkAttachmentPanel
src/components/compose/mention-picker.tsx  MentionPicker
src/components/compose/reply-banner.tsx  ReplyBanner
src/components/compose/video-preview-panel.tsx  VideoPreviewPanel
src/components/currency-toggle.tsx  CurrencyToggle
src/components/edit-profile-dialog.tsx  EditProfileDialog
src/components/faq-page.tsx  FaqPage
src/components/feedback-modal.tsx  fn FeedbackModal
src/components/form/my-error-label.tsx  MyErrorLabel
src/components/form/my-input.tsx  MyInput
src/components/group-image-picker.tsx  GroupImagePicker
src/components/header.tsx  Header
src/components/inbox-rules.tsx  fn InboxRules
src/components/install-prompt.tsx  fn InstallPrompt
src/components/join-confirmation-modal.tsx  fn JoinConfirmationModal
src/components/join-group-modal.tsx  fn JoinGroupModal
src/components/join-group-page.tsx  JoinGroupPage
src/components/landing-page.tsx  LandingPage
src/components/language-selector.tsx  fn LanguageSelector
src/components/legal-page.tsx
src/components/manage-members-dialog.tsx  ManageMembersDialog
src/components/messages/animated-emoji.tsx  fn markEmojiCodepointFailed, emojiToCodepoint, parseEmojiOnlyMessage, replaceEmojisInHtml, AnimatedEmoji
src/components/messages/audio-message.tsx  AudioMessage
src/components/messages/file-message.tsx  FileMessage
src/components/messages/formatted-message.tsx  fn preloadMarkdownPipeline, FormattedMessage
src/components/messages/gif-message.tsx  GifMessage
src/components/messages/image-message.tsx  ImageMessage
src/components/messages/join-link-preview.tsx  fn JoinLinkPreview
src/components/messages/link-preview.tsx  fn extractFirstUrl, LinkPreview
src/components/messages/message-status-indicator.tsx  MessageStatusIndicator
src/components/messages/reaction-detail-view.tsx  ReactionDetailView
src/components/messages/reaction-emoji-picker.tsx  fn ReactionEmojiPicker
src/components/messages/reaction-pills.tsx  ReactionPills
src/components/messages/reply-preview.tsx  ReplyPreview
src/components/messages/sticker-message.tsx  StickerMessage
src/components/messages/tip-message.tsx  TipMessage, TipFooter
src/components/messages/tip-pills.tsx  TipPills
src/components/messages/video-message.tsx  VideoMessage
src/components/messaging-app.tsx
src/components/messaging-bubbles.tsx  MessagingBubblesAndAvatar
src/components/messaging-conversation-accounts.tsx
src/components/messaging-conversation-button.tsx
src/components/messaging-display-avatar.tsx
src/components/messaging-setup-button.tsx  MessagingSetupButton
src/components/messaging-start-new-conversation.tsx
src/components/not-found-page.tsx  fn NotFoundPage
src/components/notification-toggle.tsx  fn NotificationToggle
src/components/onboarding/onboarding-wizard.tsx  OnboardingWizard
src/components/onboarding/pre-signup-tutorial.tsx  PreSignupTutorial
src/components/privacy-toggle.tsx  fn PrivacyToggle
src/components/profile-modal.tsx  fn ProfileModal
src/components/public-layout.tsx  PublicNav, PublicFooter
src/components/route-error-boundary.tsx  class RouteErrorBoundary
src/components/search-message-results.tsx
src/components/search-users.tsx  SearchUsers
src/components/send-funds-dialog.tsx  SendFundsDialog
src/components/send-message-button-and-input.tsx  SendMessageButtonAndInput
src/components/seo-structured-data.tsx  SeoStructuredData
src/components/settings-modal.tsx  SettingsModal
src/components/shared/alert-notification.tsx  AlertNotification
src/components/shared/chunk-error-boundary.tsx  class ChunkErrorBoundary
src/components/shared/discrete-slider.tsx  fn findClosestStopIndex, DiscreteSlider
src/components/shared/pull-to-refresh-indicator.tsx  PullToRefreshIndicator
src/components/shared/save-to-clipboard.tsx  SaveToClipboard
src/components/speed-dial-fab.tsx
src/components/start-group-chat.tsx  StartGroupChat
src/components/support-chaton-dialog.tsx  SupportChatOnDialog
src/components/support-page.tsx  SupportPage
src/components/sw-update-prompt.tsx  fn SwUpdatePrompt
src/components/tip-confirm-dialog.tsx  TipConfirmDialog
src/components/tip-currency-toggle.tsx  fn TipCurrencyToggle
src/components/user-account-list.tsx
src/components/user-action-menu.tsx  fn UserActionMenu

## Services
src/services/cache.service.ts  fn checkCacheVersion, fn cacheUserProfile, fn getCachedUserProfile, fn getCachedProfilePics, fn cacheProfilePics, fn cacheClassificationData, ... (45 exports)
src/services/community.service.ts  fn fetchGroupMemberCount, fn fetchGroupMemberCountQuick, fn fetchCommunityListings, fn listGroupInCommunity, fn unlistGroupFromCommunity, fn fetchCommunityListing, ... (8 exports)
src/services/conversations.service.tsx  fn fetchMessageThreadsRaw, fn buildShellConversations, fn decryptConversationPreviews, fn cacheDecryptionResult, fn invalidateMessageCache, fn fetchFollowedUsers, ... (47 exports)
src/services/deso-activity.service.ts  fn fetchDesoActivity
src/services/feedback.service.ts  fn submitFeedback
src/services/ffmpeg.service.ts  fn compressAudioToMp4
src/services/hidden-messages.service.ts  fn getHiddenMessageIds, hideMessage
src/services/klipy.service.ts  fn getDisplayUrl, getThumbnailUrl, getMessageUrl, searchGifs, trendingGifs, searchStickers, trendingStickers, getCategories, getSearchSuggestions, trackShare
src/services/media.service.ts  fn uploadImage, uploadVideoFile, formatFileSize
src/services/message-search.service.ts  fn searchCachedMessages, deepSearchConversation, orchestrateDeepSearch
src/services/og.service.ts  fn fetchOgData
src/services/pending-messages.service.ts  fn getPendingMessages, addPendingMessage, removePendingMessage, incrementPendingMessageRetryCount, resetPendingMessageRetryCount, clearPendingMessages
src/services/ticket.service.ts  fn submitBugReport, submitManualBugReport
src/services/translate.service.ts  fn translateText, getCachedTranslation

## Hooks
src/hooks/useAndroidBack.ts  fn useAndroidBack
src/hooks/useAudioRecorder.ts  fn useAudioRecorder
src/hooks/useDraftMessages.ts  fn useDraftMessages
src/hooks/useFocusTrap.ts  fn useFocusTrap
src/hooks/useIdleDetection.ts  fn useIdleDetection
src/hooks/useInstallPrompt.ts  fn useInstallPrompt
src/hooks/useInterval.ts  fn useInterval
src/hooks/useKeyDown.ts
src/hooks/useMembers.ts  fn useMembers
src/hooks/useMessageSearch.ts  fn useMessageSearch
src/hooks/useMobile.ts  fn useMobile
src/hooks/usePageMeta.ts  fn usePageMeta
src/hooks/usePresence.ts  fn usePresence
src/hooks/usePullToRefresh.ts  fn usePullToRefresh
src/hooks/useSwUpdate.ts  fn useSwUpdate
src/hooks/useSwipeBack.ts  fn useSwipeBack
src/hooks/useTranslation.ts  fn useTranslation
src/hooks/useTypingIndicator.ts  fn useTypingIndicator, useTypingDisplay
src/hooks/useWebSocket.ts  fn useWebSocket

## Store
src/store/index.ts  fn useStore

## Utils
src/utils/atomic-paid-message.ts  fn sendAtomicPaidMessage
src/utils/atomic-tip.ts  fn sendAtomicDesoTip, sendAtomicUsdcTip
src/utils/avatar.ts  AVATAR_COLORS | fn hashToColorIndex, getInitials
src/utils/batch-members.ts  MEMBER_BATCH_SIZE | fn batchedGetBulkAccessGroups, batchedAddMembers, batchedRemoveMembers
src/utils/community-cache.ts  fn clearCommunityCache
src/utils/constants.ts  ASSOCIATION_TYPE_APPROVED, ASSOCIATION_TYPE_BLOCKED, ASSOCIATION_VALUE_APPROVED, ASSOCIATION_VALUE_BLOCKED, ASSOCIATION_TYPE_GROUP_ARCHIVED, ASSOCIATION_TYPE_CHAT_ARCHIVED, ... (43 exports)
src/utils/detect-language.ts  fn detectLanguageSync, detectLanguage
src/utils/error-capture.ts  fn getAppVersion, getPlatform, captureError
src/utils/error-codes.ts  ERROR_CODES
src/utils/exchange-rate.ts  fn fetchExchangeRate, usdToNanos, nanosToUsd, formatUsd
src/utils/extra-data.ts  fn getEncryptedExtraDataKeys, fn parseMessageType, fn getGroupImageUrl, fn getGroupDisplayName, fn getGroupPinnedMessage, fn getGroupMembersCanShare, ... (54 exports)
src/utils/helpers.ts  fn copyTextToClipboard, fn getProfileURL, fn desoNanosToDeso, fn formatDesoAmount, fn scrollContainerToElement, fn getChatNameFromConversation, ... (13 exports)
src/utils/invite-link.ts  fn buildInviteUrl, extractInviteCode, resolveInviteCode, registerInviteCode, fetchInviteCode, revokeInviteCode
src/utils/lazy-with-reload.ts  fn lazyWithReload
src/utils/link-services.ts  fn detectLinkService, extractFileNameFromUrl
src/utils/onboarding.ts  fn isOnboardingComplete, markOnboardingComplete
src/utils/profanity-filter.ts  fn containsProfanity
src/utils/push-notifications.ts  fn requestPushPermission, subscribeToPush, getExistingSubscription, isPushSupported, getNotificationPermission, unsubscribeFromPush
src/utils/safe-login.ts  fn safeLogin, useRedirectFlow
src/utils/search-helpers.ts  fn shortenLongWord, nameOrFormattedKey
src/utils/spam-filter.ts  fn passesSenderFilter
src/utils/tip-fees.ts  fn hasTipFee, tipFeeUsd, tipRecipientUsd, splitDesoTip, splitUsdcTip
src/utils/types.ts  UNDECRYPTED_PLACEHOLDER | fn updateConv
src/utils/usdc-balance.ts  fn fetchUsdcBalance, invalidateUsdcBalanceCache, usdcBaseUnitsToUsd, usdToUsdcBaseUnits, toHexUint256
src/utils/with-auth.ts  fn withAuth, needsPermissionUpgrade, requestFullPermissions

## Worker (Cloudflare)
worker/src/chat-relay.ts  ChatRelay
worker/src/db.ts  fn upsertUser, fn upsertSubscription, fn removeSubscription, fn getOptedInUsers, fn getCronOffset, fn setCronOffset, ... (24 exports)
worker/src/deso-tx.ts  fn signTransaction, fn constructCreateAssociation, fn constructDeleteAssociation, fn submitTransaction, fn queryAssociations, fn verifyGroupOwnership
worker/src/feedback.ts  fn handleFeedbackSubmit, fn handleFeedbackCreate, fn handleFeedbackPoll, fn handleFeedbackUpdate
worker/src/index.ts
worker/src/invite-codes.ts  fn handleCreateInviteCode, fn handleRevokeInviteCode
worker/src/jwt.ts  fn validateDesoJwt
worker/src/og.ts  fn handleOgFetch
worker/src/poll.ts  fn handleScheduled
worker/src/shared-validation.ts  fn checkRateLimit, fn sanitize, fn sanitizeRequired, fn verifyApiKey, fn json, VALID_ERROR_CODES
worker/src/stats.ts  fn handleStats
worker/src/tickets.ts  fn handleTicketSubmit, fn handleTicketPoll, fn handleTicketUpdate
worker/src/web-push.ts  fn sendPushNotification
