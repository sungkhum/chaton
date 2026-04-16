import {
  Camera,
  Check,
  Copy,
  Globe,
  Link2,
  Search,
  Share2,
  Users,
  X,
} from "lucide-react";
import { BlogPostLayout } from "../blog-post-layout";

/* ─────────────────────────────────────────────────────────────────────────────
   Inline pseudo-layout illustrations.
   These mimic ChatOn's actual UI (same colors, spacing, shapes) so readers
   recognize each screen when they open the app. Decorative only —
   aria-hidden on the wrapper, alt-equivalent caption underneath.
   ──────────────────────────────────────────────────────────────────────────── */

const Figure = ({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) => (
  <figure className="my-8 not-prose">
    <div
      aria-hidden="true"
      className="rounded-2xl border border-white/8 bg-[#0a0f19] p-5 md:p-8 overflow-hidden"
    >
      <div className="flex justify-center">{children}</div>
    </div>
    <figcaption className="text-center text-xs text-gray-500 mt-3 italic">
      {caption}
    </figcaption>
  </figure>
);

const Toggle = ({ on }: { on: boolean }) => (
  <span
    className={`relative inline-block w-10 h-[22px] rounded-full shrink-0 ${
      on ? "bg-[#34F080]" : "bg-white/10"
    }`}
  >
    <span
      className={`absolute top-[3px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-transform ${
        on ? "translate-x-[21px]" : "translate-x-[3px]"
      }`}
    />
  </span>
);

const Avatar = ({
  letter,
  size = 34,
  hue = 140,
}: {
  letter: string;
  size?: number;
  hue?: number;
}) => (
  <span
    className="rounded-full inline-flex items-center justify-center text-white font-bold shrink-0"
    style={{
      width: size,
      height: size,
      fontSize: size * 0.42,
      background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${
        hue + 30
      } 70% 35%))`,
    }}
  >
    {letter}
  </span>
);

/* ─── 1. New Group dialog (full mock) ───────────────────────────────────── */
const NewGroupDialog = () => (
  <div className="bg-[#0c1220] text-white border border-white/8 w-full max-w-[380px] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8">
      <span className="text-[15px] font-semibold">New Group</span>
      <X className="w-4 h-4 text-gray-400" />
    </div>
    <div className="px-4 py-4 space-y-4">
      {/* Name + photo */}
      <div className="flex items-center gap-3.5">
        <div className="w-[52px] h-[52px] rounded-full bg-white/5 border border-dashed border-white/10 flex items-center justify-center shrink-0">
          <Camera className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 bg-white/5 rounded-xl px-3.5 py-2.5 border border-white/8">
          <span className="text-sm text-gray-500">Group name</span>
        </div>
      </div>

      {/* Members */}
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-2">
          Members
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/8">
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-sm text-gray-500">Search users…</span>
        </div>
      </div>

      {/* Sharing */}
      <div className="border-t border-white/5 pt-3.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-2.5">
          Sharing
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Link2 className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div>
                <div className="text-[13px] text-white/80">Invite link</div>
                <div className="text-[10px] text-white/25">
                  Anyone with the link can request to join
                </div>
              </div>
            </div>
            <Toggle on={false} />
          </div>
          <div className="flex items-center justify-between opacity-25">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div>
                <div className="text-[13px] text-white/80">
                  List in Community
                </div>
                <div className="text-[10px] text-white/25">
                  Let others discover this group
                </div>
              </div>
            </div>
            <Toggle on={false} />
          </div>
        </div>
      </div>
    </div>
    <div className="flex justify-end px-4 py-3 gap-2.5 border-t border-white/8">
      <span className="rounded-xl py-2 px-4 text-xs text-gray-400">Cancel</span>
      <span className="rounded-xl py-2 px-5 text-xs font-semibold text-[#34F080] bg-[#34F080]/10 border border-[#34F080]/20">
        Create
      </span>
    </div>
  </div>
);

/* ─── 2. Filled in: name + members ─────────────────────────────────────── */
const FilledGroupDialog = () => (
  <div className="bg-[#0c1220] text-white border border-white/8 w-full max-w-[380px] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8">
      <span className="text-[15px] font-semibold">New Group</span>
      <X className="w-4 h-4 text-gray-400" />
    </div>
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center gap-3.5">
        <Avatar letter="D" size={52} hue={170} />
        <div className="flex-1 bg-white/5 rounded-xl px-3.5 py-2.5 border border-[#34F080]/30">
          <span className="text-sm text-white">DeSo Builders</span>
        </div>
      </div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-2">
          Members · 3
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/8 mb-2">
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-sm text-gray-500">Search users…</span>
        </div>
        <div className="space-y-1.5">
          {[
            { name: "alice", letter: "A", hue: 200 },
            { name: "marcus", letter: "M", hue: 30 },
            { name: "priya", letter: "P", hue: 290 },
          ].map((m) => (
            <div
              key={m.name}
              className="flex items-center gap-2.5 px-2.5 py-2 bg-white/[0.03] border border-white/5 rounded-xl"
            >
              <Avatar letter={m.letter} hue={m.hue} />
              <span className="text-sm text-white font-medium flex-1">
                {m.name}
              </span>
              <X className="w-3 h-3 text-gray-500" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ─── 3. Sharing toggles enabled + description ─────────────────────────── */
const SharingToggles = () => (
  <div className="bg-[#0c1220] text-white border border-white/8 w-full max-w-[380px] rounded-2xl shadow-2xl shadow-black/40 p-4">
    <div className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-3">
      Sharing
    </div>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#34F080]/10 border border-[#34F080]/20 flex items-center justify-center">
            <Link2 className="w-3.5 h-3.5 text-[#34F080]" />
          </div>
          <div>
            <div className="text-[13px] text-white">Invite link</div>
            <div className="text-[10px] text-white/40">
              Anyone with the link can request to join
            </div>
          </div>
        </div>
        <Toggle on={true} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#34F080]/10 border border-[#34F080]/20 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-[#34F080]" />
          </div>
          <div>
            <div className="text-[13px] text-white">List in Community</div>
            <div className="text-[10px] text-white/40">
              Let others discover this group
            </div>
          </div>
        </div>
        <Toggle on={true} />
      </div>
    </div>
    <div className="mt-3 rounded-xl px-3 py-2 text-sm text-white/80 bg-white/5 border border-white/8">
      A weekly hangout for people building on the DeSo blockchain.
      <div className="text-right text-[10px] text-white/25 mt-1">62/200</div>
    </div>
  </div>
);

/* ─── 4. Group chat view (just-created) ────────────────────────────────── */
const GroupChatView = () => (
  <div className="bg-[#0c1220] text-white border border-white/8 w-full max-w-[420px] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
      <Avatar letter="D" size={36} hue={170} />
      <div className="flex-1">
        <div className="text-[14px] font-semibold">DeSo Builders</div>
        <div className="text-[11px] text-gray-500">4 members</div>
      </div>
      <Users className="w-4 h-4 text-gray-400" />
    </div>
    <div className="px-4 py-5 space-y-3 bg-[#0F1520] min-h-[180px]">
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-md px-3.5 py-2 bg-[#34F080]/15 border border-[#34F080]/20">
          <div className="text-[13px] text-white">
            Hi. This is my first message to &quot;DeSo Builders&quot;
          </div>
          <div className="text-[10px] text-white/40 text-right mt-0.5">now</div>
        </div>
      </div>
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-md px-3.5 py-2 bg-[#34F080]/15 border border-[#34F080]/20">
          <div className="text-[13px] text-white">
            Welcome everyone — glad you could join 👋
          </div>
          <div className="text-[10px] text-white/40 text-right mt-0.5">now</div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── 5. Invite link card ──────────────────────────────────────────────── */
const InviteLinkCard = () => (
  <div className="bg-[#0c1220] text-white border border-white/8 w-full max-w-[420px] rounded-2xl shadow-2xl shadow-black/40 p-4">
    <div className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-3">
      Invite link
    </div>
    <div className="flex items-center gap-2 mb-3">
      <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/8 overflow-hidden">
        <Link2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className="text-[13px] text-white/70 truncate">
          getchaton.com/join/k7m2n9px
        </span>
      </div>
      <button className="rounded-xl px-3 py-2.5 text-xs font-semibold text-[#34F080] bg-[#34F080]/10 border border-[#34F080]/20 inline-flex items-center gap-1.5">
        <Copy className="w-3.5 h-3.5" />
        Copy
      </button>
      <button className="rounded-xl px-3 py-2.5 text-xs font-semibold text-white/80 bg-white/5 border border-white/8 inline-flex items-center gap-1.5">
        <Share2 className="w-3.5 h-3.5" />
        Share
      </button>
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-white/5">
      <div>
        <div className="text-[13px] text-white/80">Members can share link</div>
        <div className="text-[10px] text-white/40">
          Off = only you can copy or share the invite
        </div>
      </div>
      <Toggle on={false} />
    </div>
  </div>
);

/* ─── 6. Community directory tile ──────────────────────────────────────── */
const CommunityTile = () => (
  <div className="w-full max-w-[420px]">
    <div className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-2 ml-1">
      Community Directory
    </div>
    <div className="bg-[#0c1220] text-white border border-white/8 rounded-2xl p-4 flex items-center gap-3">
      <Avatar letter="D" size={48} hue={170} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold">DeSo Builders</div>
        <div className="text-[11px] text-gray-500 truncate">
          A weekly hangout for people building on the DeSo blockchain.
        </div>
        <div className="text-[10px] text-white/40 mt-1">12 members</div>
      </div>
      <button className="rounded-xl px-3 py-2 text-xs font-semibold text-[#34F080] bg-[#34F080]/10 border border-[#34F080]/20 shrink-0">
        Join
      </button>
    </div>
  </div>
);

/* ─── 7. Join-requests panel ───────────────────────────────────────────── */
const RequestsPanel = () => (
  <div className="bg-[#0c1220] text-white border border-white/8 w-full max-w-[420px] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
    <div className="flex border-b border-white/8 text-[12px] font-medium">
      <div className="px-4 py-3 text-white/50">Members · 4</div>
      <div className="px-4 py-3 text-white border-b-2 border-[#34F080] -mb-px">
        Requests · 2
      </div>
    </div>
    <div className="p-3 space-y-2">
      {[
        {
          name: "rohan",
          letter: "R",
          hue: 250,
          msg: "Saw the link in the DeSo Discord",
        },
        { name: "kaia", letter: "K", hue: 320, msg: "Friend invited me" },
      ].map((r) => (
        <div
          key={r.name}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5"
        >
          <Avatar letter={r.letter} hue={r.hue} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium">{r.name}</div>
            <div className="text-[10px] text-white/40 truncate">{r.msg}</div>
          </div>
          <button className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#34F080] bg-[#34F080]/10 border border-[#34F080]/20 inline-flex items-center gap-1">
            <Check className="w-3 h-3" />
            Approve
          </button>
          <button className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/60 bg-white/5 border border-white/8">
            Decline
          </button>
        </div>
      ))}
    </div>
  </div>
);

/* ─── Post body ────────────────────────────────────────────────────────── */

const HowToCreateAGroupChat = () => (
  <BlogPostLayout
    title="How to Create a Group Chat in ChatOn (Step-by-Step)"
    description="Step-by-step guide to creating an end-to-end encrypted group chat in ChatOn. Add members, generate invite links, and list your group in the public community directory."
    date="2026-04-16"
    readTime="8 min read"
    tags={["groups", "tutorial", "community"]}
    slug="how-to-create-a-group-chat"
  >
    <p>
      Group chats are where most of the actual <em>talking</em> happens — family
      threads, project teams, neighborhood groups, fan communities, coworkers
      planning lunch. Everywhere else, those conversations live on a
      company&apos;s servers. In ChatOn they live on the{" "}
      <a href="https://deso.com" target="_blank" rel="noreferrer">
        DeSo blockchain
      </a>
      , end-to-end encrypted. The person who created the group is its admin —
      they can add or remove members, rename it, and approve join requests — but
      no platform, company, or moderator outside the group can read messages or
      take it down.
    </p>

    <p>
      Creating one takes about thirty seconds. This guide walks through every
      screen — naming the group, adding members, sharing an invite link, and
      listing your group in the public{" "}
      <a href="/community">community directory</a> so other ChatOn users can
      discover and join.
    </p>

    <h2>What makes a ChatOn group different</h2>

    <p>
      Before the steps, a quick note on what you&apos;re actually creating.
      ChatOn groups use{" "}
      <a href="https://docs.deso.org/deso-protocol/messaging/access-groups">
        DeSo access groups
      </a>{" "}
      — an on-chain primitive where each member holds an individually encrypted
      copy of the shared group key. A few practical consequences:
    </p>

    <ul>
      <li>
        <strong>Messages are encrypted before they leave your device.</strong>{" "}
        Only members hold the key. The blockchain stores ciphertext only — see{" "}
        <a href="/blog/what-is-end-to-end-encryption">
          our explainer on end-to-end encryption
        </a>{" "}
        for the deeper version.
      </li>
      <li>
        <strong>The group is portable.</strong> ChatOn doesn&apos;t own it. Any
        DeSo-compatible messaging app can read the same group with the same
        keys.
      </li>
      <li>
        <strong>No company can shut it down.</strong> If ChatOn disappeared
        tomorrow, the group would still exist on the chain. This is part of why{" "}
        <a href="/blog/near-zero-infrastructure">
          we run the whole app at near-zero cost
        </a>{" "}
        — there&apos;s no group database to maintain.
      </li>
      <li>
        <strong>The owner has admin powers, but limited reach.</strong> They can
        rename the group, change its photo, add or remove members, and approve
        join requests. They cannot delete the conversation off the blockchain,
        and — worth being honest about — removing a member doesn&apos;t
        cryptographically lock them out (more on that below).
      </li>
    </ul>

    <p>With that out of the way — let&apos;s build one.</p>

    <h2>Step 1 — Open the New Group dialog</h2>

    <p>
      In ChatOn, tap the <strong>+</strong> menu in the conversation list and
      choose <strong>New Group</strong>. You&apos;ll see this:
    </p>

    <Figure caption="The empty New Group dialog. Group name and at least one member are required; everything else is optional.">
      <NewGroupDialog />
    </Figure>

    <p>
      The same dialog works on desktop and mobile. There&apos;s no separate
      &quot;new community&quot; flow — every group can either stay private to
      the people you add or be opened up later for anyone to discover. You
      decide when you&apos;re ready.
    </p>

    <h2>Step 2 — Name the group and pick a photo</h2>

    <p>
      Tap the round photo placeholder to upload an image (it gets stored on
      DeSo&apos;s media endpoints — no third-party image host involved). Type
      the name in the field next to it. Both can be changed later by the owner,
      so don&apos;t agonize over it.
    </p>

    <Figure caption="Once you've set a name and uploaded a group photo, the field gains a subtle green border — that's how ChatOn signals 'this is good to go.'">
      <FilledGroupDialog />
    </Figure>

    <p>
      A small technical note for the curious: the name you type is the
      group&apos;s <em>display name</em>, stored in the access group&apos;s{" "}
      <code>ExtraData</code> as <code>group:displayName</code>. The
      blockchain-level identifier (the <code>AccessGroupKeyName</code>) stays
      fixed once the group is created. Renaming changes the label members see —
      it doesn&apos;t fork the group or break invite links.
    </p>

    <h2>Step 3 — Add your first members</h2>

    <p>
      Use the <strong>Search users</strong> field to find people by their DeSo
      username. Tap a result and they appear as a chip below. Repeat for
      everyone you want to add up front — you can always add more later.
    </p>

    <Figure caption="Members are chips you can tap to remove. There's no upper limit you'll bump into for a normal group; under the hood, every member gets their own encrypted copy of the group key.">
      <FilledGroupDialog />
    </Figure>

    <p>
      Worth knowing: a member you add doesn&apos;t automatically land in their{" "}
      <strong>Chats</strong> tab. Because you added them without their consent,
      ChatOn drops the group into their <strong>Requests</strong> tab first —
      the same way it handles unsolicited DMs. They move it to Chats either by
      tapping <strong>Accept</strong> or by sending their first message in the
      group (lazy acceptance). This is intentional: nobody gets pulled into a
      group conversation without an explicit signal that they want to be there.
    </p>

    <h2>Step 4 — Decide how people can find your group</h2>

    <p>
      Under <strong>Sharing</strong>, you&apos;ll see two toggles. Both are off
      by default, which means the group stays private to the people you
      personally added. Flip them on to open the group up:
    </p>

    <Figure caption="Both toggles on: anyone with the invite link can request to join, and the group appears in ChatOn's public community directory with the description you write below.">
      <SharingToggles />
    </Figure>

    <ul>
      <li>
        <strong>Invite link</strong> generates a short URL like{" "}
        <code>getchaton.com/join/k7m2n9px</code>. Anyone with the link can view
        the group&apos;s name, photo, and member count, and request to join.
        Their request goes to you — they don&apos;t auto-join.
      </li>
      <li>
        <strong>List in Community</strong> opts the group into the public
        directory at <a href="/community">getchaton.com/community</a>. People
        browsing the directory can request to join the same way. This requires
        the invite link to be on first.
      </li>
    </ul>

    <p>
      If you turn on community listing, write a short description (200
      characters or less). This is what people see when they&apos;re deciding
      whether to ask to join, so be concrete: who is this group for, what gets
      posted, when do people meet?
    </p>

    <h2>Step 5 — Tap Create and send your first message</h2>

    <p>
      Hit <strong>Create</strong>. The group appears in your conversation list,
      and ChatOn auto-sends an opening &quot;first message&quot; in your name so
      the conversation isn&apos;t literally empty when members open it. Follow
      up with something more useful — a welcome, an agenda, a ground rule — so
      the room feels alive when members arrive.
    </p>

    <Figure caption="The freshly created group. ChatOn posts an automatic opener; replace it (or add a real first message) before members start showing up.">
      <GroupChatView />
    </Figure>

    <p>
      If you turned on the invite link or community listing, ChatOn sets those
      up in the background while you&apos;re typing — no extra steps for you.
    </p>

    <h2>Inviting more people later</h2>

    <p>
      Tap the members icon in the group&apos;s header to open the manage panel.
      You&apos;ll find your invite link near the top:
    </p>

    <Figure caption="Copy the link to paste into another chat, or use Share to send it through your phone's native share sheet. Revoke deletes the invite — anyone with the old link sees an 'invalid invite' page.">
      <InviteLinkCard />
    </Figure>

    <p>
      By default only the group owner can copy or share the invite link. If you
      want every member to be able to invite friends, flip the{" "}
      <strong>Members can share link</strong> toggle. This is purely a UX gate —
      the link is still public to anyone who already has it — but it&apos;s
      useful for keeping early growth organic.
    </p>

    <h2>Approving (or declining) join requests</h2>

    <p>
      When someone clicks your invite link or finds your group in the community
      directory, they tap <strong>Request to Join</strong>. Their request shows
      up in the <strong>Requests</strong> tab of the manage panel:
    </p>

    <Figure caption="Approve adds the person as a member and posts a 'member joined' system message. Decline removes them from your pending list and records the rejection on-chain so they don't reappear next time you open the panel.">
      <RequestsPanel />
    </Figure>

    <p>
      You can approve or decline one request at a time, or select several and
      handle them in bulk. The number of pending requests shows up as a small
      badge on the members icon, so you don&apos;t have to remember to check.
    </p>

    <h2>Listing in the community directory</h2>

    <p>
      If you toggled <strong>List in Community</strong> during creation,
      you&apos;re already in. If you skipped it, open the manage panel and flip
      the same toggle there. Your group will appear at{" "}
      <a href="/community">getchaton.com/community</a> like this:
    </p>

    <Figure caption="A community directory tile. The description is what does the work — vague descriptions get fewer joins than specific ones.">
      <CommunityTile />
    </Figure>

    <p>A few things worth knowing about the directory:</p>

    <ul>
      <li>
        <strong>It&apos;s on-chain.</strong> There&apos;s no central index
        ChatOn maintains. Listings live as user associations on DeSo, so any
        DeSo-compatible app could surface the same directory.
      </li>
      <li>
        <strong>Listing requires an active invite link.</strong> If you revoke
        the link, the listing stops showing — the directory only displays groups
        people can actually join.
      </li>
      <li>
        <strong>You can unlist any time.</strong> Toggle community listing off;
        the group becomes private again, and your existing members are
        unaffected.
      </li>
    </ul>

    <h2>What happens when someone leaves (or you remove them)</h2>

    <p>
      Worth being honest about, because this works differently than most people
      assume from centralized apps: removing a member today is a{" "}
      <strong>social and UX gate, not a cryptographic one</strong>.
    </p>

    <p>
      On the UX side, the removed member no longer appears in the members list,
      loses access to the group in their ChatOn sidebar, and can&apos;t send
      messages to it. On the cryptography side, ChatOn doesn&apos;t currently
      rotate the group key when a member is removed — which means someone who
      already held the key could technically still decrypt future messages if
      they reconstructed the conversation outside the app. This is the same
      tradeoff Telegram&apos;s legacy supergroups had for years, and it&apos;s a
      known limitation of DeSo access groups we&apos;re looking at for a future
      release.
    </p>

    <p>
      The practical advice: treat group removal the way you would in WhatsApp or
      Telegram — useful for cleaning up the member list and reclaiming the
      social space, but don&apos;t rely on it as a guarantee that a removed
      member can never read anything posted later. For genuinely sensitive
      conversations with someone you no longer trust, start a fresh group.
    </p>

    <h2>Common questions</h2>

    <h3>Is everyone&apos;s name and group membership public?</h3>
    <p>
      The <em>existence</em> of the group and the list of public keys that hold
      its key are visible on-chain — that&apos;s how the encryption works. The{" "}
      <em>contents</em> of every message are not. If your members use anonymous
      DeSo accounts (no profile, no real name), the group is effectively
      pseudonymous.
    </p>

    <h3>How big can a ChatOn group get?</h3>
    <p>
      In practice, hundreds of members work fine. The architectural ceiling is
      much higher — the limit you&apos;ll hit first is social, not technical. If
      you&apos;re building something that wants thousands of participants, list
      it in the community directory and let people opt in rather than adding
      them yourself.
    </p>

    <h3>What does it cost to create or send messages in a group?</h3>
    <p>
      Each message is a DeSo transaction costing roughly{" "}
      <strong>$0.000017</strong> — fractions of a cent, paid in DESO by the
      sender. New accounts get free starter DESO at signup, which covers
      thousands of messages. There&apos;s no subscription, no per-member fee,
      and no &quot;groups premium&quot; tier.
    </p>

    <h3>Can I transfer ownership of a group?</h3>
    <p>
      Not currently. The on-chain owner is the public key that created the
      group, and that relationship is fixed. If you need a co-admin in practice,
      the simplest workaround is to share the &quot;members can share link&quot;
      permission and trust co-organizers to invite people. We&apos;re looking at
      proper co-ownership for a future release.
    </p>

    <h3>What happens if ChatOn (the app) goes away?</h3>
    <p>
      The group keeps existing on the DeSo blockchain. Any other DeSo-compatible
      messaging client can read the same access group with the same keys. This
      is the practical version of &quot;own your data&quot; — your group
      isn&apos;t locked into our codebase.
    </p>

    <hr />

    <p>
      That&apos;s the whole flow. If you haven&apos;t opened ChatOn yet,{" "}
      <a href="/">getchaton.com</a> works in any browser — no download, no app
      store, no phone number. If you want to see what other people are building,
      browse the <a href="/community">community directory</a> and join a group
      or three before you start your own.
    </p>
  </BlogPostLayout>
);

export default HowToCreateAGroupChat;
