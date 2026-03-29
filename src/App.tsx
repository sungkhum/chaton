import {
  configure,
  createAccessGroup,
  getAllAccessGroups,
  getUsersStateless,
  identity,
  NOTIFICATION_EVENTS,
  User,
} from "deso-protocol";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { Header } from "./components/header";
import { InstallPrompt } from "./components/install-prompt";
import { LandingPage } from "./components/landing-page";
import { LegalPage } from "./components/legal-page";
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

  // Legal pages are always accessible regardless of auth state
  if (path === "/privacy") {
    return <LegalPage type="privacy" />;
  }
  if (path === "/terms") {
    return <LegalPage type="terms" />;
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

  return (
    <div className="App">
      <Header />
      <section className="h-[calc(100%-56px)] mt-[56px] overflow-scroll">
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
