import { useStore } from "../store";
import {
  AccessGroupEntryResponse,
  AccessGroupPrivateInfo,
  addAccessGroupMembers,
  encrypt,
  getAllAccessGroupsMemberOnly,
  getBulkAccessGroups,
  identity,
  publicKeyToBase58Check,
  removeAccessGroupMembers,
  waitForTransactionFound,
} from "deso-protocol";
import { withAuth } from "../utils/with-auth";
import { Loader2, Users, X } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { toast } from "sonner";
import useKeyDown from "../hooks/useKeyDown";
import { useMembers } from "../hooks/useMembers";
import { useMobile } from "../hooks/useMobile";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../utils/constants";
import { Conversation } from "../utils/types";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { SearchUsers } from "./search-users";

export interface ManageMembersDialogProps {
  onSuccess: () => void;
  conversation: Conversation;
  isGroupOwner: boolean;
}

export const ManageMembersDialog = ({
  onSuccess,
  conversation,
  isGroupOwner,
}: ManageMembersDialogProps) => {
  const { appUser } = useStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { members, addMember, removeMember, onPairMissing, currentMemberKeys } =
    useMembers(setLoading, open, conversation);
  const membersAreaRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMobile();

  const handleOpen = () => setOpen(!open);
  const groupName = conversation.messages[0].RecipientInfo.AccessGroupKeyName;

  useKeyDown(() => {
    if (open) setOpen(false);
  }, ["Escape"]);

  const formSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const areMembersDefined = Array.isArray(members) && members.length > 0;
    if (!areMembersDefined) {
      toast.error("At least one member should be added");
      return;
    }

    const memberKeys = members.map((e) => e.id);
    const memberKeysToAdd = memberKeys.filter((k) => !currentMemberKeys.includes(k));
    const memberKeysToRemove = currentMemberKeys.filter((e) => !memberKeys.includes(e));

    setUpdating(true);
    try {
      await addMembersAction(groupName, memberKeysToAdd);
      await removeMembersAction(groupName, memberKeysToRemove);
    } finally {
      setUpdating(false);
    }

    onSuccess();
    handleOpen();
  };

  const addMembersAction = async (groupName: string, memberKeys: Array<string>) => {
    if (!appUser) return Promise.reject(new Error("You are not logged in."));
    return updateMembers(
      groupName,
      memberKeys,
      async (groupEntries?: Array<AccessGroupEntryResponse>) => {
        let accessGroupKeyInfo: AccessGroupPrivateInfo;
        try {
          const resp = await getAllAccessGroupsMemberOnly({
            PublicKeyBase58Check: appUser.PublicKeyBase58Check,
          });

          const encryptedKey = (resp.AccessGroupsMember ?? []).find(
            (entry) =>
              entry?.AccessGroupOwnerPublicKeyBase58Check === appUser.PublicKeyBase58Check &&
              entry?.AccessGroupKeyName === groupName &&
              entry?.AccessGroupMemberEntryResponse
          )?.AccessGroupMemberEntryResponse?.EncryptedKey;

          if (encryptedKey) {
            const keys = await identity.decryptAccessGroupKeyPair(encryptedKey);
            const pkBs58Check = await publicKeyToBase58Check(keys.public);
            accessGroupKeyInfo = {
              AccessGroupPublicKeyBase58Check: pkBs58Check,
              AccessGroupPrivateKeyHex: keys.seedHex,
              AccessGroupKeyName: groupName,
            };
          }
        } catch (e) {
          accessGroupKeyInfo = await identity.accessGroupStandardDerivation(groupName);
        }

        const memberList = await Promise.all(
          (groupEntries || []).map(async (entry) => ({
            AccessGroupMemberPublicKeyBase58Check: entry.AccessGroupOwnerPublicKeyBase58Check,
            AccessGroupMemberKeyName: entry.AccessGroupKeyName,
            EncryptedKey: await encrypt(
              entry.AccessGroupPublicKeyBase58Check,
              accessGroupKeyInfo!.AccessGroupPrivateKeyHex
            ),
          }))
        );

        const { submittedTransactionResponse } = await withAuth(() =>
          addAccessGroupMembers({
            AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
            AccessGroupKeyName: groupName,
            AccessGroupMemberList: memberList,
            MinFeeRateNanosPerKB: 1000,
          })
        );

        if (!submittedTransactionResponse) {
          throw new Error("Failed to submit transaction to add members to group.");
        }
        return waitForTransactionFound(submittedTransactionResponse.TxnHashHex);
      }
    );
  };

  const removeMembersAction = async (groupName: string, memberKeys: Array<string>) => {
    if (!appUser) {
      toast.error("You are not logged in.");
      return;
    }
    return updateMembers(
      groupName,
      memberKeys,
      async (groupEntries?: Array<AccessGroupEntryResponse>) => {
        const { submittedTransactionResponse } = await withAuth(() =>
          removeAccessGroupMembers({
            AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
            AccessGroupKeyName: groupName,
            AccessGroupMemberList: (groupEntries || []).map((entry) => ({
              AccessGroupMemberPublicKeyBase58Check: entry.AccessGroupOwnerPublicKeyBase58Check,
              AccessGroupMemberKeyName: entry.AccessGroupKeyName,
              EncryptedKey: "",
            })),
            MinFeeRateNanosPerKB: 1000,
          })
        );

        if (!submittedTransactionResponse) {
          throw new Error("Failed to submit transaction to update group members.");
        }
        return waitForTransactionFound(submittedTransactionResponse.TxnHashHex);
      }
    );
  };

  const updateMembers = async (
    groupName: string,
    memberKeys: Array<string>,
    updateAction: (entries?: Array<AccessGroupEntryResponse>) => Promise<void>
  ) => {
    if (memberKeys.length === 0) return;

    const { AccessGroupEntries, PairsNotFound } = await getBulkAccessGroups({
      GroupOwnerAndGroupKeyNamePairs: memberKeys.map((pubKey) => ({
        GroupOwnerPublicKeyBase58Check: pubKey,
        GroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
      })),
    });

    if (PairsNotFound?.length) {
      onPairMissing();
      return;
    }

    await updateAction(AccessGroupEntries).catch(() =>
      toast.error("Something went wrong while submitting the transaction")
    );
  };

  return (
    <Fragment>
      <button
        onClick={handleOpen}
        className="text-blue-400 bg-transparent p-0 flex items-center cursor-pointer"
      >
        <Users className="mr-2 w-6 h-6" />
        <span className="hidden items-center md:flex font-medium text-base">
          View Members
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={handleOpen} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#050e1d] text-blue-100 border border-blue-900 w-[90%] md:w-[40%] rounded-lg">
              <div className="text-blue-100 p-5 border-b border-blue-600/20">
                <div className="flex justify-between w-full items-center">
                  <span className="text-xl font-semibold">
                    All Members (
                    {loading ? (
                      <Loader2 className="w-4 h-4 inline animate-spin" />
                    ) : (
                      currentMemberKeys.length
                    )}
                    )
                  </span>
                  <div className="text-sm text-right font-normal text-blue-300/60 flex">
                    <div>
                      <strong className="text-blue-300/80">Group Name</strong>
                      <br />
                      {groupName}
                    </div>
                    {!isGroupOwner && (
                      <div className="pl-2">
                        <X
                          className="w-6 h-6 cursor-pointer"
                          onClick={() => setOpen(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <form name="start-group-chat-form" onSubmit={formSubmit}>
                <div className="p-5 pb-0">
                  <div className="mb-0">
                    {isGroupOwner && (
                      <SearchUsers
                        className="text-white placeholder:text-blue-100 bg-blue-900/20 placeholder-gray"
                        onSelected={(member) =>
                          addMember(member, () => {
                            setTimeout(() => {
                              membersAreaRef.current?.scrollTo(0, membersAreaRef.current.scrollHeight);
                            }, 0);
                          })
                        }
                      />
                    )}

                    <div
                      className="max-h-[400px] mt-3 pr-3 overflow-y-auto custom-scrollbar overflow-hidden"
                      ref={membersAreaRef}
                    >
                      {loading ? (
                        <div className="text-center">
                          <Loader2 className="w-11 h-11 mt-4 animate-spin text-blue-600 mx-auto" />
                        </div>
                      ) : (
                        members.map((member) => (
                          <div
                            className="flex p-1.5 md:p-4 items-center cursor-pointer text-white bg-blue-900/20 border border-blue-600/20 rounded-md my-2"
                            key={member.id}
                          >
                            <MessagingDisplayAvatar
                              username={member.text}
                              publicKey={member.id}
                              diameter={isMobile ? 40 : 50}
                              classNames="mx-0"
                            />
                            <div className="flex justify-between items-center flex-1 overflow-auto">
                              <div className="mx-2 md:ml-4 max-w-[calc(100%-105px)]">
                                <div className="font-medium truncate">{member.text}</div>
                                {isGroupOwner && currentMemberKeys.includes(member.id) && (
                                  <div className="text-xs md:text-sm text-blue-300/80 mt-1">
                                    Already in the chat
                                  </div>
                                )}
                              </div>
                              {isGroupOwner && member.id !== appUser?.PublicKeyBase58Check && (
                                <button
                                  className="rounded-full mr-1 md:mr-3 px-3 py-2 border text-white bg-red-400/20 hover:bg-red-400/30 border-red-600/60 text-sm md:px-4 cursor-pointer"
                                  onClick={() => removeMember(member.id)}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end p-5 border-t border-blue-600/20 gap-3">
                  {isGroupOwner && (
                    <>
                      <button
                        onClick={handleOpen}
                        type="button"
                        className="rounded-full py-2 bg-transparent border border-blue-600/60 text-sm px-4 text-blue-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-[#ffda59] text-[#6d4800] rounded-full py-2 hover:brightness-95 text-sm px-4 flex items-center cursor-pointer"
                        disabled={updating}
                      >
                        {updating && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                        <span>Update Group</span>
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </Fragment>
  );
};
