import {
  configure,
  createAccessGroup,
  getAllAccessGroups,
  getUsersStateless,
  identity,
  NOTIFICATION_EVENTS,
  User,
} from "deso-protocol";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { Header } from "./components/header";
import { InstallPrompt } from "./components/install-prompt";
import { MessagingApp } from "./components/messaging-app";
import { RouteErrorBoundary } from "./components/route-error-boundary";

// bundle-dynamic-imports: Lazy-load route pages so GSAP and page code
// stay out of the main chunk. Logged-in users never download landing page code.
const LandingPage = lazy(() => import("./components/landing-page").then(m => ({ default: m.LandingPage })));
const LegalPage = lazy(() => import("./components/legal-page").then(m => ({ default: m.LegalPage })));
const SupportPage = lazy(() => import("./components/support-page").then(m => ({ default: m.SupportPage })));
const JoinGroupPage = lazy(() => import("./components/join-group-page"));
const CommunityPage = lazy(() => import("./components/community-page"));
import { AppUser, useStore } from "./store";
import { withAuth } from "./utils/with-auth";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  DESO_NETWORK,
  getTransactionSpendingLimits,
} from "./utils/constants";
import {
  getCachedUserProfile,
  cacheUserProfile,
  clearCacheForUser,
  checkCacheVersion,
} from "./services/cache.service";
import { clearDecryptionCaches } from "./services/conversations.service";

// Mobile browsers and in-app browsers (Telegram, Instagram, etc.) can't
// reliably use popups for identity login — window.open() either opens a new
// tab (breaking postMessage) or gets blocked entirely by WebView/WKWebView.
// Use the redirect flow instead: navigate to identity, then back with query params.
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const useRedirectFlow = isStandalone || isMobile;

configure({
  identityURI: import.meta.env.VITE_IDENTITY_URL,
  nodeURI: import.meta.env.VITE_NODE_URL,
  network: DESO_NETWORK,
  spendingLimitOptions: getTransactionSpendingLimits(""),
  ...(useRedirectFlow && {
    redirectURI: window.location.origin + window.location.pathname,
  }),
});

// The SDK constructor calls handleRedirectURI(location.search) when search
// params exist, but that runs BEFORE configure() — so redirectURI isn't set
// yet. Call it again AFTER configure(), but ONLY when the URL actually has
// identity redirect params. Calling it on clean URLs passes undefined to
// URLSearchParams which crashes in some WebKit versions.
if (useRedirectFlow && window.location.search.includes("service=identity")) {
  identity.handleRedirectURI(window.location.href);
}

// Check cache version — clears stale data on schema changes
checkCacheVersion();

// If opened from a push notification, stash the conversation key so
// messaging-app can navigate to it after conversations load.
const conversationParam = new URLSearchParams(window.location.search).get("conversation");
if (conversationParam) {
  useStore.getState().setPendingConversationKey(conversationParam);
  window.history.replaceState({}, "", window.location.pathname);
}

function App() {
  // ── Hydrate a logged-in user (cache-first, background revalidation) ──
  const hydrateUser = useRef<((publicKey: string, messagingKey: string) => void) | null>(null);
  hydrateUser.current = (publicKey: string, messagingPublicKeyBase58Check: string) => {
    const { setAppUser, setIsLoadingUser, setAllAccessGroups } = useStore.getState();
    let pollingId = 0;

    useStore.getState().resetChatRequestState();

    const cached = getCachedUserProfile(publicKey);
    const hasDefaultGroup = cached?.allAccessGroups.some(
      (g) => g.AccessGroupKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME
    );

    if (cached && hasDefaultGroup) {
      // Cache hit — render immediately, refresh in background
      setAppUser(cached.appUser);
      useStore.setState({ allAccessGroups: cached.allAccessGroups });
      setIsLoadingUser(false);

      Promise.all([
        getUser(publicKey),
        getAllAccessGroups({ PublicKeyBase58Check: publicKey }),
      ])
        .then(([userRes, { AccessGroupsOwned, AccessGroupsMember }]) => {
          const user: User | null = userRes.UserList?.[0] ?? null;
          if (!user) return;
          const freshAppUser: AppUser = {
            ...user,
            messagingPublicKeyBase58Check,
            accessGroupsOwned: AccessGroupsOwned,
          };
          const allGroups = (AccessGroupsOwned || []).concat(AccessGroupsMember || []);
          setAppUser(freshAppUser);
          useStore.setState({ allAccessGroups: allGroups });
          cacheUserProfile(publicKey, freshAppUser, allGroups);

          window.clearInterval(pollingId);
          if (user.BalanceNanos === 0) {
            pollingId = window.setInterval(async () => {
              getUser(publicKey).then((res) => {
                const u = res.UserList?.[0];
                if (u && u.BalanceNanos > 0) {
                  setAppUser({ ...u, messagingPublicKeyBase58Check });
                  window.clearInterval(pollingId);
                }
              });
            }, 3000);
          }
        })
        .catch(() => { /* Background refresh failed — cached data is still showing */ });
    } else {
      // Cache miss or first-time setup — blocking flow
      setIsLoadingUser(true);
      Promise.all([
        getUser(publicKey),
        getAllAccessGroups({ PublicKeyBase58Check: publicKey }),
      ])
        .then(([userRes, { AccessGroupsOwned, AccessGroupsMember }]) => {
          if (
            !AccessGroupsOwned?.find(
              ({ AccessGroupKeyName }) => AccessGroupKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME
            )
          ) {
            return withAuth(() =>
              createAccessGroup({
                AccessGroupOwnerPublicKeyBase58Check: publicKey,
                AccessGroupPublicKeyBase58Check: messagingPublicKeyBase58Check,
                AccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
                MinFeeRateNanosPerKB: 1000,
              })
            ).then(() =>
              getAllAccessGroups({ PublicKeyBase58Check: publicKey }).then((groups) => {
                const user: User | null = userRes.UserList?.[0] ?? null;
                const appUser: AppUser | null = user
                  ? { ...user, messagingPublicKeyBase58Check, accessGroupsOwned: groups.AccessGroupsOwned }
                  : null;
                const allGroups = (AccessGroupsOwned || []).concat(AccessGroupsMember || []);
                setAppUser(appUser);
                useStore.setState({ allAccessGroups: allGroups });
                if (appUser) cacheUserProfile(publicKey, appUser, allGroups);
                return user;
              })
            );
          } else {
            const user: User | null = userRes.UserList?.[0] ?? null;
            const appUser: AppUser | null = user
              ? { ...user, messagingPublicKeyBase58Check, accessGroupsOwned: AccessGroupsOwned }
              : null;
            const allGroups = (AccessGroupsOwned || []).concat(AccessGroupsMember || []);
            setAppUser(appUser);
            useStore.setState({ allAccessGroups: allGroups });
            if (appUser) cacheUserProfile(publicKey, appUser, allGroups);
            return user;
          }
        })
        .then((user) => {
          if (!user) return;
          window.clearInterval(pollingId);
          if (user.BalanceNanos === 0) {
            pollingId = window.setInterval(async () => {
              getUser(publicKey).then((res) => {
                const u = res.UserList?.[0];
                if (u && u.BalanceNanos > 0) {
                  setAppUser({ ...u, messagingPublicKeyBase58Check });
                  window.clearInterval(pollingId);
                }
              });
            }, 3000);
          }
        })
        .catch((err) => {
          console.error("[ChatOn] Failed to hydrate user:", err);
        })
        .finally(() => {
          setIsLoadingUser(false);
        });
    }
  };

  const { setAppUser, setIsLoadingUser } = useStore();

  useEffect(
    () => {
      // ── Snapshot-based init (like Diamond app) ──
      // Use identity.snapshot() to read current state synchronously from
      // localStorage. No iframe, no callbacks, no waiting. Instant.
      try {
        const { currentUser } = identity.snapshot() as { currentUser: any };
        if (currentUser) {
          const messagingKey = currentUser.primaryDerivedKey?.messagingPublicKeyBase58Check;
          if (messagingKey) {
            hydrateUser.current?.(currentUser.publicKey, messagingKey);
          } else {
            console.warn("[ChatOn] Missing messagingPublicKeyBase58Check — resetting");
            setIsLoadingUser(false);
          }
        } else {
          // No user in localStorage — logged out. Render landing page instantly.
          setIsLoadingUser(false);
        }
      } catch (err) {
        console.error("[ChatOn] identity.snapshot() failed:", err);
        setIsLoadingUser(false);
      }

      // ── Subscribe for ongoing state changes (login, logout, user switch) ──
      // This handles events AFTER initial load — not needed for boot.
      identity.subscribe(({ event, currentUser, alternateUsers }) => {
        const store = useStore.getState();

        // Ignore intermediate authorization events — only act on final states
        if (
          event === NOTIFICATION_EVENTS.AUTHORIZE_DERIVED_KEY_START ||
          event === NOTIFICATION_EVENTS.AUTHORIZE_DERIVED_KEY_END ||
          event === NOTIFICATION_EVENTS.LOGIN_START ||
          event === NOTIFICATION_EVENTS.REQUEST_PERMISSIONS_START ||
          event === NOTIFICATION_EVENTS.REQUEST_PERMISSIONS_END
        ) {
          return;
        }

        // User logged out
        if (event === NOTIFICATION_EVENTS.LOGOUT_END) {
          const loggedOutKey = store.appUser?.PublicKeyBase58Check;
          if (loggedOutKey) clearCacheForUser(loggedOutKey);
          clearDecryptionCaches();

          if (alternateUsers && Object.keys(alternateUsers).length > 0) {
            const fallbackUser = Object.values(alternateUsers)[0];
            identity.setActiveUser(fallbackUser.publicKey);
          } else {
            setAppUser(null);
            setIsLoadingUser(false);
          }
          useStore.getState().resetChatRequestState();
          return;
        }

        // No user — logged out
        if (!currentUser) {
          setAppUser(null);
          setIsLoadingUser(false);
          return;
        }

        // New user logged in or switched (different from current appUser)
        if (
          currentUser.publicKey !== store.appUser?.PublicKeyBase58Check &&
          [
            NOTIFICATION_EVENTS.LOGIN_END,
            NOTIFICATION_EVENTS.CHANGE_ACTIVE_USER,
          ].includes(event)
        ) {
          clearDecryptionCaches();
          const messagingKey = currentUser.primaryDerivedKey?.messagingPublicKeyBase58Check;
          if (messagingKey) {
            hydrateUser.current?.(currentUser.publicKey, messagingKey);
          } else {
            console.warn("[ChatOn] Missing messagingPublicKeyBase58Check — resetting");
            setAppUser(null);
            setIsLoadingUser(false);
          }
          return;
        }

        // Same user re-authorized (permissions upgrade) — just clear loading
        if (
          currentUser.publicKey === store.appUser?.PublicKeyBase58Check &&
          store.isLoadingUser
        ) {
          setIsLoadingUser(false);
        }
      }).catch((err) => {
        console.error("[ChatOn] identity.subscribe failed:", err);
        setAppUser(null);
        setIsLoadingUser(false);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { appUser, isLoadingUser } = useStore();
  const path = window.location.pathname;
  const splashRemovedRef = useRef(false);

  // Remove splash once content is ready (not during loading)
  const isJoinRoute = path === "/join" || path.startsWith("/join/");
  const contentReady = !isLoadingUser || !!appUser || path === "/privacy" || path === "/terms" || path === "/support" || path === "/community" || isJoinRoute;
  useEffect(() => {
    if (!contentReady || splashRemovedRef.current) return;
    splashRemovedRef.current = true;
    // Wait one frame so the DOM is painted before fading
    requestAnimationFrame(() => {
      const splash = document.getElementById("splash");
      if (!splash) return;
      splash.style.pointerEvents = "none";
      splash.style.transition = "opacity 0.3s ease-out";
      splash.style.opacity = "0";
      const remove = () => splash.remove();
      splash.addEventListener("transitionend", remove);
      // Fallback if transitionend never fires
      setTimeout(remove, 400);
    });
  }, [contentReady]);

  // Safety: remove splash after 5s no matter what (prevents permanent splash on error)
  useEffect(() => {
    const timer = setTimeout(() => {
      const splash = document.getElementById("splash");
      if (!splash) return;
      splash.style.pointerEvents = "none";
      splash.style.transition = "opacity 0.3s ease-out";
      splash.style.opacity = "0";
      setTimeout(() => splash.remove(), 400);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Shared fallback for lazy-loaded route pages — keeps the splash feel
  // instead of flashing a blank white screen on slow connections.
  const routeFallback = (
    <div className="App flex items-center justify-center">
      <img src="/ChatOn-Logo-Small.png" alt="ChatOn" width={80} height={80} className="rounded-[20px] animate-pulse" />
    </div>
  );

  // Legal pages are always accessible regardless of auth state
  if (path === "/privacy") {
    return <RouteErrorBoundary><Suspense fallback={routeFallback}><LegalPage type="privacy" /></Suspense></RouteErrorBoundary>;
  }
  if (path === "/terms") {
    return <RouteErrorBoundary><Suspense fallback={routeFallback}><LegalPage type="terms" /></Suspense></RouteErrorBoundary>;
  }
  if (path === "/support") {
    return (
      <RouteErrorBoundary>
        <Suspense fallback={routeFallback}>
          <SupportPage />
          <Toaster position="top-right" theme="dark" />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  if (path === "/community") {
    return (
      <RouteErrorBoundary>
        <Suspense fallback={routeFallback}>
          <CommunityPage />
          <Toaster position="top-right" theme="dark" />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  if (isJoinRoute) {
    return (
      <RouteErrorBoundary>
        <Suspense fallback={routeFallback}>
          <JoinGroupPage />
          <Toaster position="top-right" theme="dark" />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  const showLanding = !appUser && !isLoadingUser;

  if (showLanding) {
    return (
      <RouteErrorBoundary>
        <Suspense fallback={routeFallback}>
          <LandingPage />
          <Toaster position="top-right" theme="dark" />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  if (isLoadingUser && !appUser) {
    return (
      <div className="App flex items-center justify-center">
        <img
          src="/ChatOn-Logo-Small.png"
          alt="ChatOn"
          width={80}
          height={80}
          className="rounded-[20px]"
          style={{ animation: "splash-pulse 1.8s ease-in-out infinite" }}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <Header />
      <section className="h-[calc(100%-56px)] mt-[56px] overflow-hidden">
        <MessagingApp />
      </section>
      <InstallPrompt />
      <Toaster position="top-right" theme="dark" />
    </div>
  );
}

const getUser = async (publicKey: string) =>
  getUsersStateless({
    PublicKeysBase58Check: [publicKey],
    SkipForLeaderboard: true,
    IncludeBalance: true,
    GetUnminedBalance: true,
  });

export default App;
