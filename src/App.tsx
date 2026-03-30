import {
  configure,
  createAccessGroup,
  getAllAccessGroups,
  getUsersStateless,
  identity,
  NOTIFICATION_EVENTS,
  User,
} from "deso-protocol";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { Header } from "./components/header";
import { InstallPrompt } from "./components/install-prompt";
import { LandingPage } from "./components/landing-page";
import { LegalPage } from "./components/legal-page";
import { SupportPage } from "./components/support-page";
import { MessagingApp } from "./components/messaging-app";
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

// Safari iOS PWA standalone mode can't use popups for identity login —
// window.open() either opens in Safari (breaking postMessage) or gets blocked.
// Use the redirect flow instead: navigate to identity, then back with query params.
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

configure({
  identityURI: import.meta.env.VITE_IDENTITY_URL,
  nodeURI: import.meta.env.VITE_NODE_URL,
  network: DESO_NETWORK,
  spendingLimitOptions: getTransactionSpendingLimits(""),
  ...(isStandalone && {
    redirectURI: window.location.origin + window.location.pathname,
  }),
});

// Handle returning redirect from identity in PWA mode
if (isStandalone) {
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
  const { setAppUser, setIsLoadingUser, setAllAccessGroups } = useStore();

  useEffect(
    () => {
      let pollingIntervalId = 0;

      identity.subscribe(({ event, currentUser, alternateUsers }) => {
        const store = useStore.getState();

        if (!currentUser && !alternateUsers) {
          setAppUser(null);
          setIsLoadingUser(false);
          return;
        }

        if (
          event === NOTIFICATION_EVENTS.AUTHORIZE_DERIVED_KEY_START &&
          currentUser
        ) {
          setIsLoadingUser(true);
          return;
        }

        if (
          currentUser &&
          currentUser?.publicKey !== store.appUser?.PublicKeyBase58Check &&
          [
            NOTIFICATION_EVENTS.SUBSCRIBE,
            NOTIFICATION_EVENTS.LOGIN_END,
            NOTIFICATION_EVENTS.CHANGE_ACTIVE_USER,
          ].includes(event)
        ) {
          const { messagingPublicKeyBase58Check } =
            currentUser.primaryDerivedKey;

          useStore.getState().resetChatRequestState();

          // Try cache-first: show cached profile instantly, refresh in background
          const cached = getCachedUserProfile(currentUser.publicKey);
          const hasDefaultGroup = cached?.allAccessGroups.some(
            (g) => g.AccessGroupKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME
          );

          if (cached && hasDefaultGroup) {
            // Cache hit — render immediately, refresh in background
            setAppUser(cached.appUser);
            useStore.setState({ allAccessGroups: cached.allAccessGroups });
            setIsLoadingUser(false);

            // Background revalidation
            Promise.all([
              getUser(currentUser.publicKey),
              getAllAccessGroups({
                PublicKeyBase58Check: currentUser.publicKey,
              }),
            ])
              .then(([userRes, { AccessGroupsOwned, AccessGroupsMember }]) => {
                const user: User | null = userRes.UserList?.[0] ?? null;
                if (!user) return;
                const freshAppUser: AppUser = {
                  ...user,
                  messagingPublicKeyBase58Check,
                  accessGroupsOwned: AccessGroupsOwned,
                };
                const allGroups = (AccessGroupsOwned || []).concat(
                  AccessGroupsMember || []
                );
                setAppUser(freshAppUser);
                useStore.setState({ allAccessGroups: allGroups });
                cacheUserProfile(currentUser.publicKey, freshAppUser, allGroups);

                window.clearInterval(pollingIntervalId);
                if (user.BalanceNanos === 0) {
                  pollingIntervalId = window.setInterval(async () => {
                    getUser(currentUser.publicKey).then((res) => {
                      const u = res.UserList?.[0];
                      if (u && u.BalanceNanos > 0) {
                        setAppUser({ ...u, messagingPublicKeyBase58Check });
                        window.clearInterval(pollingIntervalId);
                      }
                    });
                  }, 3000);
                }
              })
              .catch(() => {
                // Background refresh failed — cached data is still showing
              });
          } else {
            // Cache miss or first-time setup — blocking flow
            setIsLoadingUser(true);
            Promise.all([
              getUser(currentUser.publicKey),
              getAllAccessGroups({
                PublicKeyBase58Check: currentUser.publicKey,
              }),
            ])
              .then(([userRes, { AccessGroupsOwned, AccessGroupsMember }]) => {
                if (
                  !AccessGroupsOwned?.find(
                    ({ AccessGroupKeyName }) =>
                      AccessGroupKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME
                  )
                ) {
                  return withAuth(() =>
                    createAccessGroup({
                      AccessGroupOwnerPublicKeyBase58Check:
                        currentUser.publicKey,
                      AccessGroupPublicKeyBase58Check:
                        messagingPublicKeyBase58Check,
                      AccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
                      MinFeeRateNanosPerKB: 1000,
                    })
                  ).then(() => {
                    return getAllAccessGroups({
                      PublicKeyBase58Check: currentUser.publicKey,
                    }).then((groups) => {
                      const user: User | null =
                        userRes.UserList?.[0] ?? null;
                      const appUser: AppUser | null = user
                        ? {
                            ...user,
                            messagingPublicKeyBase58Check,
                            accessGroupsOwned: groups.AccessGroupsOwned,
                          }
                        : null;
                      const allGroups = (AccessGroupsOwned || []).concat(
                        AccessGroupsMember || []
                      );

                      setAppUser(appUser);
                      useStore.setState({ allAccessGroups: allGroups });
                      if (appUser) {
                        cacheUserProfile(
                          currentUser.publicKey,
                          appUser,
                          allGroups
                        );
                      }
                      return user;
                    });
                  });
                } else {
                  const user: User | null = userRes.UserList?.[0] ?? null;
                  const appUser: AppUser | null = user
                    ? {
                        ...user,
                        messagingPublicKeyBase58Check,
                        accessGroupsOwned: AccessGroupsOwned,
                      }
                    : null;
                  const allGroups = (AccessGroupsOwned || []).concat(
                    AccessGroupsMember || []
                  );

                  setAppUser(appUser);
                  useStore.setState({ allAccessGroups: allGroups });
                  if (appUser) {
                    cacheUserProfile(
                      currentUser.publicKey,
                      appUser,
                      allGroups
                    );
                  }
                  return user;
                }
              })
              .then((user) => {
                if (!user) return;
                window.clearInterval(pollingIntervalId);
                if (user.BalanceNanos === 0) {
                  pollingIntervalId = window.setInterval(async () => {
                    getUser(currentUser.publicKey).then((res) => {
                      const user = res.UserList?.[0];
                      if (user && user.BalanceNanos > 0) {
                        setAppUser({
                          ...user,
                          messagingPublicKeyBase58Check,
                        });
                        window.clearInterval(pollingIntervalId);
                      }
                    });
                  }, 3000);
                }
              })
              .finally(() => {
                setIsLoadingUser(false);
              });
          }
          return;
        }

        if (event === NOTIFICATION_EVENTS.LOGOUT_END) {
          useStore.getState().resetChatRequestState();
          const loggedOutKey = store.appUser?.PublicKeyBase58Check;
          if (loggedOutKey) {
            clearCacheForUser(loggedOutKey);
          }
          if (alternateUsers) {
            const fallbackUser = Object.values(alternateUsers)[0];
            identity.setActiveUser(fallbackUser.publicKey);
            return;
          }
          return;
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { appUser, isLoadingUser } = useStore();
  const path = window.location.pathname;
  const splashRemovedRef = useRef(false);

  // Remove splash once content is ready (not during loading)
  const contentReady = !isLoadingUser || !!appUser || path === "/privacy" || path === "/terms" || path === "/support";
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

  // Legal pages are always accessible regardless of auth state
  if (path === "/privacy") {
    return <LegalPage type="privacy" />;
  }
  if (path === "/terms") {
    return <LegalPage type="terms" />;
  }
  if (path === "/support") {
    return (
      <>
        <SupportPage />
        <Toaster position="top-right" theme="dark" />
      </>
    );
  }

  const showLanding = !appUser && !isLoadingUser;

  if (showLanding) {
    return (
      <>
        <LandingPage />
        <Toaster position="top-right" theme="dark" />
      </>
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
