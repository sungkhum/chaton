import { createAccessGroup, getAllAccessGroups, identity } from "deso-protocol";
import { withAuth } from "../utils/with-auth";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "utils/constants";
import { hasSetupMessaging } from "utils/helpers";
import { SendFundsDialog } from "./send-funds-dialog";

export const MessagingSetupButton = () => {
  const { appUser, isLoadingUser, setAccessGroups, setAllAccessGroups } =
    useStore(useShallow((s) => ({ appUser: s.appUser, isLoadingUser: s.isLoadingUser, setAccessGroups: s.setAccessGroups, setAllAccessGroups: s.setAllAccessGroups })));
  const [isSettingUpMessage, setIsSettingUpMessaging] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);

  if (hasSetupMessaging(appUser)) {
    return <div>Something is wrong, your account is already set up.</div>;
  }

  if (isLoadingUser) {
    return (
      <div className="flex justify-center">
        <Loader2 className="w-11 h-11 mt-4 animate-spin text-[#34F080]" />
      </div>
    );
  }

  if (!appUser) {
    return (
      <button
        className="bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black font-bold rounded-full hover:brightness-110 text-lg px-6 py-3 cursor-pointer"
        onClick={() => identity.login()}
      >
        Login with DeSo or Ethereum
      </button>
    );
  }

  if (appUser.BalanceNanos === 0) {
    return (
      <>
        <button
          className="bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black font-bold rounded-xl hover:brightness-110 text-lg px-6 py-3 cursor-pointer"
          onClick={() => setOpenDialog(true)}
        >
          Get $DESO to get started
        </button>
        {openDialog && (
          <SendFundsDialog
            appUser={appUser}
            onClose={() => setOpenDialog(false)}
          />
        )}
      </>
    );
  }

  return (
    <button
      className="bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black font-bold rounded-xl hover:brightness-110 text-lg px-6 py-3 cursor-pointer"
      onClick={async () => {
        setIsSettingUpMessaging(true);
        try {
          await withAuth(() =>
            createAccessGroup({
              AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
              AccessGroupPublicKeyBase58Check:
                appUser.messagingPublicKeyBase58Check,
              AccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
              MinFeeRateNanosPerKB: 1000,
            })
          );

          const { AccessGroupsOwned, AccessGroupsMember } =
            await getAllAccessGroups({
              PublicKeyBase58Check: appUser.PublicKeyBase58Check,
            });

          if (!AccessGroupsOwned) {
            throw new Error("did not get any access groups");
          }

          setAccessGroups(AccessGroupsOwned);
          setAllAccessGroups(
            AccessGroupsOwned.concat(AccessGroupsMember || [])
          );
        } catch (e: any) {
          toast.error("Something went wrong when setting up the account");
          console.error(e);
        }
        setIsSettingUpMessaging(false);
      }}
    >
      <div className="flex justify-center">
        {isSettingUpMessage ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <div className="mr-2">Setup account for messaging</div>
        )}
      </div>
    </button>
  );
};
