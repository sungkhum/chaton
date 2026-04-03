import { SearchUsers } from "components/search-users";
import {
  addAccessGroupMembers,
  createAccessGroup,
  encrypt,
  getBulkAccessGroups,
  identity,
} from "deso-protocol";
import { Globe, Link2, Loader2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { toast } from "sonner";
import { useMembers } from "../hooks/useMembers";
import { useMobile } from "../hooks/useMobile";
import { encryptAndSendNewMessage } from "../services/conversations.service";
import { listGroupInCommunity } from "../services/community.service";
import { registerInviteCode } from "../utils/invite-link";
import { withAuth } from "../utils/with-auth";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../utils/constants";
import { GROUP_DISPLAY_NAME, GROUP_IMAGE_URL } from "../utils/extra-data";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { GroupImagePicker } from "./group-image-picker";
import { MyInput } from "./form/my-input";
import useKeyDown from "../hooks/useKeyDown";

export interface StartGroupChatProps {
  onSuccess: (pubKey: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const StartGroupChat = ({ onSuccess, open: controlledOpen, onOpenChange }: StartGroupChatProps) => {
  const appUser = useStore((s) => s.appUser);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [loading, setLoading] = useState(false);
  const [chatName, setChatName] = useState<string>("");
  const [groupImageUrl, setGroupImageUrl] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [formTouched, setFormTouched] = useState<boolean>(false);
  const [wantInviteLink, setWantInviteLink] = useState(false);
  const [wantCommunityList, setWantCommunityList] = useState(false);
  const [communityDescription, setCommunityDescription] = useState("");
  const { members, addMember, removeMember, onPairMissing } = useMembers(
    setLoading,
    open
  );
  const membersAreaRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMobile();

  const handleOpen = () => setOpen(!open);

  useKeyDown(() => {
    if (open) setOpen(false);
  }, ["Escape"]);

  useEffect(() => {
    if (!open) {
      setChatName("");
      setGroupImageUrl("");
      setFormTouched(false);
      setWantInviteLink(false);
      setWantCommunityList(false);
      setCommunityDescription("");
    }
  }, [open]);

  const isNameValid = () => chatName && chatName.trim();
  const areMembersValid = () => Array.isArray(members) && members.length > 0;

  const formSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormTouched(true);
    if (!isNameValid() || !areMembersValid()) return;

    const newGroupKey = await startGroupChat(
      chatName.trim(),
      members.map((e) => e.id),
      groupImageUrl
    );
    if (newGroupKey) onSuccess(newGroupKey);
    handleOpen();
  };

  const startGroupChat = async (groupName: string, memberKeys: Array<string>, imageUrl: string) => {
    if (!appUser) {
      toast.error("You must be logged in to start a group chat.");
      return;
    }

    setLoading(true);

    try {
      const accessGroupKeys = await identity.accessGroupStandardDerivation(groupName);

      const extraData: Record<string, string> = {};
      extraData[GROUP_DISPLAY_NAME] = groupName;
      if (imageUrl) extraData[GROUP_IMAGE_URL] = imageUrl;

      await withAuth(() =>
        createAccessGroup({
          AccessGroupKeyName: groupName,
          AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          AccessGroupPublicKeyBase58Check: accessGroupKeys.AccessGroupPublicKeyBase58Check,
          MinFeeRateNanosPerKB: 1000,
          ...(Object.keys(extraData).length > 0 && { ExtraData: extraData }),
        })
      );

      const groupMembersArray = Array.from(
        new Set([...memberKeys, appUser.PublicKeyBase58Check])
      );

      const { AccessGroupEntries, PairsNotFound } = await getBulkAccessGroups({
        GroupOwnerAndGroupKeyNamePairs: groupMembersArray.map((key) => ({
          GroupOwnerPublicKeyBase58Check: key,
          GroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
        })),
      });

      if (PairsNotFound?.length) {
        onPairMissing();
        return;
      }

      const groupMemberList = await Promise.all(
        AccessGroupEntries.map(async (accessGroupEntry) => ({
          AccessGroupMemberPublicKeyBase58Check:
            accessGroupEntry.AccessGroupOwnerPublicKeyBase58Check,
          AccessGroupMemberKeyName: accessGroupEntry.AccessGroupKeyName,
          EncryptedKey: await encrypt(
            accessGroupEntry.AccessGroupPublicKeyBase58Check,
            accessGroupKeys.AccessGroupPrivateKeyHex
          ),
        }))
      );

      await withAuth(() =>
        addAccessGroupMembers({
          AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          AccessGroupKeyName: groupName,
          AccessGroupMemberList: groupMemberList,
          MinFeeRateNanosPerKB: 1000,
        })
      );

      await encryptAndSendNewMessage(
        `Hi. This is my first message to "${groupName}"`,
        appUser.PublicKeyBase58Check,
        appUser.PublicKeyBase58Check,
        groupName
      );

      // Post-creation: invite link + community listing (non-blocking)
      if (wantInviteLink || wantCommunityList) {
        try {
          await registerInviteCode(appUser.PublicKeyBase58Check, groupName);
          if (wantCommunityList) {
            await listGroupInCommunity(
              appUser.PublicKeyBase58Check,
              groupName,
              communityDescription.trim()
            );
          }
        } catch (e) {
          console.error("Post-creation setup error:", e);
          toast.error("Group created, but invite link or community listing failed. You can set these up in group settings.");
        }
      }

      return `${appUser.PublicKeyBase58Check}${accessGroupKeys.AccessGroupKeyName}`;
    } catch (e) {
      console.error(e);
      toast.error("something went wrong while submitting the add members transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Fragment>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 z-50" onClick={handleOpen} />
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a1019] text-white border border-white/10 w-[90%] md:w-[40%] rounded-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="text-white text-xl font-semibold p-5 border-b border-white/10 shrink-0">
                Start New Group Chat
              </div>

              <form name="start-group-chat-form" onSubmit={formSubmit} className="flex flex-col min-h-0 flex-1">
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                  <div className="mb-4 md:mb-8 flex items-start gap-4">
                    <GroupImagePicker
                      imageUrl={groupImageUrl}
                      onImageChange={setGroupImageUrl}
                      onUploadingChange={setImageUploading}
                      groupName={chatName}
                      diameter={64}
                    />
                    <div className="flex-1">
                      <MyInput
                        label="Name"
                        error={formTouched && !isNameValid() ? "Group name must be defined" : ""}
                        placeholder="Group name"
                        value={chatName}
                        setValue={setChatName}
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-lg font-semibold mb-2 text-white">
                      Add Users to Your Group Chat
                    </div>
                    <SearchUsers
                      className="text-white placeholder:text-gray-500 bg-white/5 border-white/10"
                      onSelected={(member) =>
                        addMember(member, () => {
                          setTimeout(() => {
                            membersAreaRef.current?.scrollTo(0, membersAreaRef.current.scrollHeight);
                          }, 0);
                        })
                      }
                      error={formTouched && !areMembersValid() ? "At least one member must be added" : ""}
                    />

                    <div
                      className="max-h-[400px] mt-1 pr-3 overflow-y-auto custom-scrollbar overflow-hidden"
                      ref={membersAreaRef}
                    >
                      {members.map((member) => (
                        <div
                          className="flex p-1.5 md:p-4 items-center cursor-pointer text-white bg-white/5 border border-white/8 rounded-xl my-2"
                          key={member.id}
                        >
                          <MessagingDisplayAvatar
                            username={member.text}
                            publicKey={member.id}
                            diameter={isMobile ? 40 : 44}
                            classNames="mx-0"
                          />
                          <div className="flex justify-between align-center flex-1 text-white overflow-auto">
                            <span className="mx-2 md:ml-4 font-medium truncate my-auto">
                              {member.text}
                            </span>
                            <button
                              className="rounded-full mr-1 md:mr-3 px-3 py-2 border text-white bg-red-400/20 hover:bg-red-400/30 border-red-600/60 text-sm md:px-4 cursor-pointer"
                              onClick={() => removeMember(member.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sharing section */}
                  <div className="border-t border-white/8 pt-4">
                    <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-3">
                      Sharing
                    </div>

                    {/* Invite link toggle */}
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Link2 className="w-4 h-4 text-blue-300 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm text-blue-200 font-medium">Create invite link</span>
                          <p className="text-xs text-white/30">Anyone with the link can request to join</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !wantInviteLink;
                          setWantInviteLink(next);
                          if (!next) setWantCommunityList(false);
                        }}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                          wantInviteLink ? "bg-[#34F080]" : "bg-white/10 border border-white/15"
                        }`}
                        aria-label="Toggle invite link"
                      >
                        <div className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-transform ${
                          wantInviteLink ? "translate-x-[21px]" : "translate-x-[3px]"
                        }`} />
                      </button>
                    </div>

                    {/* Community listing toggle */}
                    <div className={`flex items-center justify-between py-2 transition-opacity ${
                      wantInviteLink ? "opacity-100" : "opacity-30 pointer-events-none"
                    }`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Globe className="w-4 h-4 text-blue-300 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm text-blue-200 font-medium">List in Community</span>
                          <p className="text-xs text-white/30">Let others discover this group</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !wantCommunityList;
                          setWantCommunityList(next);
                          if (next && !wantInviteLink) setWantInviteLink(true);
                        }}
                        disabled={!wantInviteLink}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 disabled:cursor-not-allowed ${
                          wantCommunityList ? "bg-[#34F080]" : "bg-white/10 border border-white/15"
                        }`}
                        aria-label="Toggle community listing"
                      >
                        <div className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-transform ${
                          wantCommunityList ? "translate-x-[21px]" : "translate-x-[3px]"
                        }`} />
                      </button>
                    </div>

                    {/* Description field (visible when community listing is on) */}
                    {wantCommunityList && (
                      <div className="mt-2 ml-[26px]">
                        <textarea
                          value={communityDescription}
                          onChange={(e) => setCommunityDescription(e.target.value.slice(0, 200))}
                          placeholder="Short description for the directory..."
                          rows={2}
                          className="w-full rounded-lg px-3 py-2 text-sm text-blue-200 placeholder:text-white/20 bg-white/5 border border-white/10 focus:border-white/20 outline-none resize-none"
                        />
                        <div className="text-right text-[11px] text-white/25 mt-1">
                          {communityDescription.length}/200
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end p-5 gap-3 border-t border-white/8 shrink-0">
                  <button
                    onClick={handleOpen}
                    type="button"
                    className="rounded-full py-2 bg-transparent border border-white/15 text-sm px-4 text-gray-300 hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black font-bold rounded-full py-2 hover:brightness-110 text-sm px-4 flex items-center cursor-pointer"
                    disabled={loading || imageUploading}
                  >
                    {(loading || imageUploading) && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                    <span>{imageUploading ? "Uploading..." : "Create Chat"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </Fragment>
  );
};
