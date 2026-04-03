import { SearchUsers } from "components/search-users";
import {
  addAccessGroupMembers,
  createAccessGroup,
  encrypt,
  getBulkAccessGroups,
  identity,
} from "deso-protocol";
import { Globe, Link2, Loader2, X } from "lucide-react";
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
import useKeyDown from "../hooks/useKeyDown";

export interface StartGroupChatProps {
  onSuccess: (pubKey: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultCommunity?: boolean;
}

export const StartGroupChat = ({ onSuccess, open: controlledOpen, onOpenChange, defaultCommunity }: StartGroupChatProps) => {
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
    } else if (defaultCommunity) {
      setWantInviteLink(true);
      setWantCommunityList(true);
    }
  }, [open, defaultCommunity]);

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
          <div className="fixed inset-0 bg-black/60 z-[60] modal-backdrop-enter" onClick={handleOpen} />
          {/* Dialog */}
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="bg-[#0c1220] text-white border border-white/8 w-[min(95vw,440px)] rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/40 modal-card-enter">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8 shrink-0">
                <span className="text-[15px] font-semibold text-white">New Group</span>
                <button
                  type="button"
                  onClick={handleOpen}
                  className="p-1 -mr-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4.5 h-4.5 text-gray-400" />
                </button>
              </div>

              <form name="start-group-chat-form" onSubmit={formSubmit} className="flex flex-col min-h-0 flex-1">
                <div className="px-4 py-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-4">

                  {/* Group identity: photo + name */}
                  <div className="flex items-center gap-3.5">
                    <GroupImagePicker
                      imageUrl={groupImageUrl}
                      onImageChange={setGroupImageUrl}
                      onUploadingChange={setImageUploading}
                      groupName={chatName}
                      diameter={52}
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={chatName}
                        onChange={(e) => setChatName(e.target.value)}
                        placeholder="Group name"
                        autoFocus
                        className={`w-full bg-white/5 text-white text-sm placeholder:text-gray-500 rounded-xl px-3.5 py-2.5 outline-none border transition-colors ${
                          formTouched && !isNameValid()
                            ? "border-red-500/60"
                            : "border-white/8 focus:border-[#34F080]/40"
                        }`}
                      />
                      {formTouched && !isNameValid() && (
                        <p className="text-red-400 text-xs mt-1 ml-1">Group name is required</p>
                      )}
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-2">
                      Members
                    </div>
                    <SearchUsers
                      className="text-white placeholder:text-gray-500 bg-white/5 border-white/8"
                      onSelected={(member) =>
                        addMember(member, () => {
                          setTimeout(() => {
                            membersAreaRef.current?.scrollTo(0, membersAreaRef.current.scrollHeight);
                          }, 0);
                        })
                      }
                      error={formTouched && !areMembersValid() ? "Add at least one member" : ""}
                    />

                    <div
                      className="max-h-[200px] mt-1.5 overflow-y-auto custom-scrollbar space-y-1.5"
                      ref={membersAreaRef}
                    >
                      {members.map((member) => (
                        <div
                          className="flex items-center gap-2.5 px-2.5 py-2 bg-white/[0.03] border border-white/5 rounded-xl group"
                          key={member.id}
                        >
                          <MessagingDisplayAvatar
                            username={member.text}
                            publicKey={member.id}
                            diameter={isMobile ? 32 : 34}
                            classNames="mx-0"
                          />
                          <span className="text-sm text-white font-medium truncate flex-1">
                            {member.text}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMember(member.id)}
                            className="p-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sharing */}
                  <div className="border-t border-white/5 pt-3.5">
                    <div className="text-xs font-medium uppercase tracking-wider text-white/30 mb-2.5">
                      Sharing
                    </div>

                    <div className="space-y-1">
                      {/* Invite link toggle */}
                      <div className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                            <Link2 className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="text-sm text-white/80">Invite link</div>
                            <div className="text-[11px] text-white/25 leading-tight">Anyone with the link can request to join</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !wantInviteLink;
                            setWantInviteLink(next);
                            if (!next) setWantCommunityList(false);
                          }}
                          className={`relative w-10 h-[22px] rounded-full transition-colors cursor-pointer shrink-0 ml-3 ${
                            wantInviteLink ? "bg-[#34F080]" : "bg-white/10"
                          }`}
                          aria-label="Toggle invite link"
                        >
                          <div className={`w-[16px] h-[16px] rounded-full bg-white absolute top-[3px] transition-transform shadow-sm ${
                            wantInviteLink ? "translate-x-[21px]" : "translate-x-[3px]"
                          }`} />
                        </button>
                      </div>

                      {/* Community listing toggle */}
                      <div className={`flex items-center justify-between py-1.5 transition-opacity ${
                        wantInviteLink ? "opacity-100" : "opacity-25 pointer-events-none"
                      }`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                            <Globe className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="text-sm text-white/80">List in Community</div>
                            <div className="text-[11px] text-white/25 leading-tight">Let others discover this group</div>
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
                          className={`relative w-10 h-[22px] rounded-full transition-colors cursor-pointer shrink-0 disabled:cursor-not-allowed ml-3 ${
                            wantCommunityList ? "bg-[#34F080]" : "bg-white/10"
                          }`}
                          aria-label="Toggle community listing"
                        >
                          <div className={`w-[16px] h-[16px] rounded-full bg-white absolute top-[3px] transition-transform shadow-sm ${
                            wantCommunityList ? "translate-x-[21px]" : "translate-x-[3px]"
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* Description field (visible when community listing is on) */}
                    {wantCommunityList && (
                      <div className="mt-2.5">
                        <textarea
                          value={communityDescription}
                          onChange={(e) => setCommunityDescription(e.target.value.slice(0, 200))}
                          placeholder="Short description for the directory..."
                          rows={2}
                          className="w-full rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 bg-white/5 border border-white/8 focus:border-white/15 outline-none resize-none"
                        />
                        <div className="text-right text-[11px] text-white/20 mt-0.5">
                          {communityDescription.length}/200
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end px-4 py-3 gap-2.5 border-t border-white/8 shrink-0">
                  <button
                    onClick={handleOpen}
                    type="button"
                    className="rounded-xl py-2 px-4 text-sm text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="glass-btn-primary text-[#34F080] font-semibold rounded-xl py-2 px-5 text-sm flex items-center cursor-pointer transition-colors disabled:opacity-50"
                    disabled={loading || imageUploading}
                  >
                    {(loading || imageUploading) && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                    <span>{imageUploading ? "Uploading..." : "Create"}</span>
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
