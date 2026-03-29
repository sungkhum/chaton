import { getUsersStateless, identity, User } from "deso-protocol";
import { Identity } from "deso-protocol/src/identity/identity";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { formatDisplayName } from "../utils/helpers";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import {
  cacheAccountProfiles,
  getCachedAccountProfiles,
} from "../services/cache.service";

const COLLAPSED_ACCOUNTS_NUM = 3;
const EXPANDED_ACCOUNTS_NUM = 10;
const ACCOUNT_LIST_ITEM_HEIGHT_PX = 30;

type Account = {
  name: string;
  onclick: (key: string) => void;
  key: string;
  profile: User;
  hasProfile: boolean;
  isActive: boolean;
};

const UserAccountList = ({ onSwitch }: { onSwitch?: () => void }) => {
  const { appUser } = useStore();
  const [showMore, setShowMore] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const snapshot = (identity as Identity<Storage>).snapshot();
    const activeUser = snapshot.currentUser;
    const alternateUsers = Object.keys(snapshot.alternateUsers || {});
    const loggedInUserKeys = [
      ...(activeUser ? [activeUser.publicKey] : []),
      ...alternateUsers,
    ];

    // Try to restore from cache first
    const cached = getCachedAccountProfiles();
    if (cached) {
      const cachedUsers = loggedInUserKeys
        .map((key) => cached[key] as User | undefined)
        .filter(Boolean) as User[];
      if (cachedUsers.length > 0) {
        setUsers(cachedUsers);
      }
    }

    // Show placeholder keys for any not in cache
    if (!cached || loggedInUserKeys.some((key) => !cached[key])) {
      setUsers((prev) =>
        prev.length > 0
          ? prev
          : (loggedInUserKeys.map((key) => ({
              PublicKeyBase58Check: key,
            })) as User[])
      );
    }

    // Refresh in background (no loading spinner if we have cached data)
    const hasCachedData = cached && loggedInUserKeys.every((key) => cached[key]);
    if (!hasCachedData) setLoading(true);

    const fetchLoggedInUsers = async () => {
      if (loggedInUserKeys.length === 0) return;
      try {
        const res = await getUsersStateless({
          PublicKeysBase58Check: loggedInUserKeys,
          SkipForLeaderboard: true,
        });
        if (res.UserList) {
          setUsers(res.UserList);
          // Update cache
          const profileMap: Record<string, unknown> = {};
          for (const user of res.UserList) {
            profileMap[user.PublicKeyBase58Check] = user;
          }
          cacheAccountProfiles(profileMap);
        }
      } catch (e) {
        toast.error(`Error fetching user profiles: ${e}`);
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchLoggedInUsers();
  }, [appUser]);

  useEffect(() => {
    const accounts = (users || []).map((user) => {
      const key = user.PublicKeyBase58Check;
      const isActive = key === appUser?.PublicKeyBase58Check;
      const profile = isActive && appUser ? appUser : user;
      const hasProfile = !!profile;
      return {
        name: formatDisplayName(user, ""),
        onclick: (key: string) => {
          if (key === appUser?.PublicKeyBase58Check) return;
          identity.setActiveUser(key);
          onSwitch?.();
        },
        key,
        profile,
        hasProfile,
        isActive,
      };
    });
    const sortedAccounts = [...accounts].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.hasProfile !== b.hasProfile) return a.hasProfile ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    setAllAccounts(sortedAccounts);
  }, [users, appUser]);

  const visibleAccounts = showMore
    ? allAccounts
    : allAccounts.slice(0, COLLAPSED_ACCOUNTS_NUM);

  return (
    <div className={`mb-0 ${loading || visibleAccounts.length > 0 ? "border-b border-white/10" : ""}`}>
      {loading ? (
        <div className="flex justify-center my-2 h-[29px]">
          <Loader2 className="w-6 h-6 animate-spin text-[#34F080]" />
        </div>
      ) : (
        <>
          <section
            className="custom-scrollbar"
            aria-labelledby="dropdownInformationButton"
            style={
              showMore
                ? {
                    maxHeight: `${EXPANDED_ACCOUNTS_NUM * ACCOUNT_LIST_ITEM_HEIGHT_PX}px`,
                    overflowY: "scroll",
                  }
                : {}
            }
          >
            {visibleAccounts.map((option) => (
              <div
                key={option.key}
                onClick={() => option.onclick(option.key)}
                className="cursor-pointer text-md pl-2 py-1 hover:bg-white/5 rounded-md transition-colors"
              >
                <div className={`flex items-center ${option.isActive ? "font-bold text-white" : "text-gray-300"}`}>
                  <MessagingDisplayAvatar
                    publicKey={option.key}
                    username={option.name}
                    classNames="mr-2 ml-0"
                    diameter={28}
                  />
                  <div className="truncate text-base">{option.name}</div>
                </div>
              </div>
            ))}
          </section>

          {!showMore && allAccounts.length > COLLAPSED_ACCOUNTS_NUM && (
            <span
              className="text-[#34F080] text-sm text-left mx-3 mt-2 mb-3 block cursor-pointer hover:text-[#34F080]/80 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowMore(true);
              }}
            >
              Show more
            </span>
          )}
        </>
      )}
    </div>
  );
};

export { UserAccountList };
