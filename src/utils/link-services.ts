/**
 * Detects known sharing/cloud services from a URL and returns
 * branding metadata for richer link card rendering.
 */

export interface LinkService {
  /** Display name, e.g. "Google Drive" */
  name: string;
  /** Short label for the icon badge, e.g. "GD" */
  badge: string;
  /** Tailwind bg class for the icon badge */
  badgeBg: string;
  /** Tailwind text class for the icon badge */
  badgeText: string;
  /** Tailwind gradient classes for the card background */
  cardGradient: string;
  /** Tailwind border class for the card */
  cardBorder: string;
}

interface ServicePattern {
  /** Hostnames to match (after stripping www.) */
  hosts: string[];
  /** Optional path prefix to match (e.g. "/wiki" for Confluence) */
  pathPrefix?: string;
  service: LinkService;
}

const SERVICES: ServicePattern[] = [
  // ── Cloud Storage ──────────────────────────────────────────
  {
    hosts: ["drive.google.com", "docs.google.com", "sheets.google.com", "slides.google.com", "forms.google.com"],
    service: {
      name: "Google Drive",
      badge: "GD",
      badgeBg: "bg-yellow-500/20",
      badgeText: "text-yellow-400",
      cardGradient: "from-yellow-900/30 to-orange-900/20",
      cardBorder: "border-yellow-700/30",
    },
  },
  {
    hosts: ["dropbox.com", "dl.dropboxusercontent.com"],
    service: {
      name: "Dropbox",
      badge: "DB",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/40 to-blue-800/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["onedrive.live.com", "1drv.ms"],
    service: {
      name: "OneDrive",
      badge: "OD",
      badgeBg: "bg-sky-500/20",
      badgeText: "text-sky-400",
      cardGradient: "from-sky-900/35 to-blue-900/20",
      cardBorder: "border-sky-700/30",
    },
  },
  {
    hosts: ["sharepoint.com"],
    service: {
      name: "SharePoint",
      badge: "SP",
      badgeBg: "bg-teal-500/20",
      badgeText: "text-teal-400",
      cardGradient: "from-teal-900/35 to-cyan-900/20",
      cardBorder: "border-teal-700/30",
    },
  },
  {
    hosts: ["box.com", "app.box.com"],
    service: {
      name: "Box",
      badge: "Bx",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-300",
      cardGradient: "from-blue-900/35 to-slate-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["icloud.com"],
    service: {
      name: "iCloud",
      badge: "iC",
      badgeBg: "bg-gray-400/20",
      badgeText: "text-gray-300",
      cardGradient: "from-gray-800/40 to-slate-900/20",
      cardBorder: "border-gray-600/30",
    },
  },
  {
    hosts: ["wetransfer.com", "we.tl"],
    service: {
      name: "WeTransfer",
      badge: "WT",
      badgeBg: "bg-cyan-500/20",
      badgeText: "text-cyan-400",
      cardGradient: "from-cyan-900/35 to-blue-900/20",
      cardBorder: "border-cyan-700/30",
    },
  },

  // ── Dev Tools ──────────────────────────────────────────────
  {
    hosts: ["github.com", "gist.github.com"],
    service: {
      name: "GitHub",
      badge: "GH",
      badgeBg: "bg-gray-400/20",
      badgeText: "text-gray-200",
      cardGradient: "from-gray-800/50 to-gray-900/30",
      cardBorder: "border-gray-600/30",
    },
  },
  {
    hosts: ["gitlab.com"],
    service: {
      name: "GitLab",
      badge: "GL",
      badgeBg: "bg-orange-500/20",
      badgeText: "text-orange-400",
      cardGradient: "from-orange-900/30 to-red-900/20",
      cardBorder: "border-orange-700/30",
    },
  },
  {
    hosts: ["bitbucket.org"],
    service: {
      name: "Bitbucket",
      badge: "BB",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/40 to-indigo-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["codesandbox.io"],
    service: {
      name: "CodeSandbox",
      badge: "CS",
      badgeBg: "bg-gray-400/20",
      badgeText: "text-gray-200",
      cardGradient: "from-gray-800/45 to-slate-900/20",
      cardBorder: "border-gray-600/30",
    },
  },
  {
    hosts: ["stackblitz.com"],
    service: {
      name: "StackBlitz",
      badge: "SB",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-300",
      cardGradient: "from-blue-900/40 to-indigo-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["npmjs.com"],
    service: {
      name: "npm",
      badge: "npm",
      badgeBg: "bg-red-500/20",
      badgeText: "text-red-400",
      cardGradient: "from-red-900/30 to-rose-900/20",
      cardBorder: "border-red-700/30",
    },
  },
  {
    hosts: ["vercel.com"],
    service: {
      name: "Vercel",
      badge: "V",
      badgeBg: "bg-gray-400/20",
      badgeText: "text-gray-100",
      cardGradient: "from-gray-800/50 to-gray-900/30",
      cardBorder: "border-gray-600/30",
    },
  },
  {
    hosts: ["netlify.com", "netlify.app"],
    service: {
      name: "Netlify",
      badge: "N",
      badgeBg: "bg-teal-500/20",
      badgeText: "text-teal-300",
      cardGradient: "from-teal-900/35 to-cyan-900/20",
      cardBorder: "border-teal-700/30",
    },
  },

  // ── Design ─────────────────────────────────────────────────
  {
    hosts: ["figma.com"],
    service: {
      name: "Figma",
      badge: "Fg",
      badgeBg: "bg-purple-500/20",
      badgeText: "text-purple-400",
      cardGradient: "from-purple-900/35 to-violet-900/20",
      cardBorder: "border-purple-700/30",
    },
  },
  {
    hosts: ["canva.com"],
    service: {
      name: "Canva",
      badge: "Ca",
      badgeBg: "bg-cyan-500/20",
      badgeText: "text-cyan-400",
      cardGradient: "from-cyan-900/35 to-teal-900/20",
      cardBorder: "border-cyan-700/30",
    },
  },
  {
    hosts: ["miro.com"],
    service: {
      name: "Miro",
      badge: "Mi",
      badgeBg: "bg-yellow-500/20",
      badgeText: "text-yellow-400",
      cardGradient: "from-yellow-900/30 to-amber-900/20",
      cardBorder: "border-yellow-700/30",
    },
  },
  {
    hosts: ["sketch.com"],
    service: {
      name: "Sketch",
      badge: "Sk",
      badgeBg: "bg-orange-500/20",
      badgeText: "text-orange-400",
      cardGradient: "from-orange-900/30 to-yellow-900/20",
      cardBorder: "border-orange-700/30",
    },
  },

  // ── Video & Media ──────────────────────────────────────────
  {
    hosts: ["youtube.com", "youtu.be"],
    service: {
      name: "YouTube",
      badge: "YT",
      badgeBg: "bg-red-500/20",
      badgeText: "text-red-400",
      cardGradient: "from-red-900/35 to-rose-900/20",
      cardBorder: "border-red-700/30",
    },
  },
  {
    hosts: ["vimeo.com"],
    service: {
      name: "Vimeo",
      badge: "Vm",
      badgeBg: "bg-cyan-500/20",
      badgeText: "text-cyan-400",
      cardGradient: "from-cyan-900/35 to-sky-900/20",
      cardBorder: "border-cyan-700/30",
    },
  },
  {
    hosts: ["loom.com"],
    service: {
      name: "Loom",
      badge: "Lo",
      badgeBg: "bg-purple-500/20",
      badgeText: "text-purple-400",
      cardGradient: "from-purple-900/35 to-indigo-900/20",
      cardBorder: "border-purple-700/30",
    },
  },
  {
    hosts: ["twitch.tv"],
    service: {
      name: "Twitch",
      badge: "Tw",
      badgeBg: "bg-violet-500/20",
      badgeText: "text-violet-400",
      cardGradient: "from-violet-900/35 to-purple-900/20",
      cardBorder: "border-violet-700/30",
    },
  },
  {
    hosts: ["spotify.com", "open.spotify.com"],
    service: {
      name: "Spotify",
      badge: "Sp",
      badgeBg: "bg-green-500/20",
      badgeText: "text-green-400",
      cardGradient: "from-green-900/35 to-emerald-900/20",
      cardBorder: "border-green-700/30",
    },
  },
  {
    hosts: ["soundcloud.com"],
    service: {
      name: "SoundCloud",
      badge: "SC",
      badgeBg: "bg-orange-500/20",
      badgeText: "text-orange-400",
      cardGradient: "from-orange-900/30 to-amber-900/20",
      cardBorder: "border-orange-700/30",
    },
  },

  // ── Productivity ───────────────────────────────────────────
  {
    hosts: ["notion.so", "notion.site"],
    service: {
      name: "Notion",
      badge: "N",
      badgeBg: "bg-gray-400/20",
      badgeText: "text-gray-200",
      cardGradient: "from-gray-800/50 to-slate-900/25",
      cardBorder: "border-gray-600/30",
    },
  },
  {
    hosts: ["linear.app"],
    service: {
      name: "Linear",
      badge: "Li",
      badgeBg: "bg-indigo-500/20",
      badgeText: "text-indigo-400",
      cardGradient: "from-indigo-900/35 to-violet-900/20",
      cardBorder: "border-indigo-700/30",
    },
  },
  {
    hosts: ["trello.com"],
    service: {
      name: "Trello",
      badge: "Tr",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/40 to-sky-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["airtable.com"],
    service: {
      name: "Airtable",
      badge: "At",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-300",
      cardGradient: "from-blue-900/35 to-indigo-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["coda.io"],
    service: {
      name: "Coda",
      badge: "Co",
      badgeBg: "bg-orange-500/20",
      badgeText: "text-orange-400",
      cardGradient: "from-orange-900/30 to-red-900/20",
      cardBorder: "border-orange-700/30",
    },
  },
  {
    hosts: ["asana.com"],
    service: {
      name: "Asana",
      badge: "As",
      badgeBg: "bg-rose-500/20",
      badgeText: "text-rose-400",
      cardGradient: "from-rose-900/30 to-pink-900/20",
      cardBorder: "border-rose-700/30",
    },
  },
  {
    hosts: ["clickup.com"],
    service: {
      name: "ClickUp",
      badge: "CU",
      badgeBg: "bg-violet-500/20",
      badgeText: "text-violet-400",
      cardGradient: "from-violet-900/35 to-purple-900/20",
      cardBorder: "border-violet-700/30",
    },
  },
  {
    hosts: ["monday.com"],
    service: {
      name: "monday.com",
      badge: "Mo",
      badgeBg: "bg-red-500/20",
      badgeText: "text-red-400",
      cardGradient: "from-red-900/30 to-orange-900/20",
      cardBorder: "border-red-700/30",
    },
  },

  // ── Atlassian suite ────────────────────────────────────────
  {
    hosts: ["atlassian.net"],
    pathPrefix: "/wiki",
    service: {
      name: "Confluence",
      badge: "Cf",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/40 to-indigo-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["atlassian.net"],
    service: {
      name: "Jira",
      badge: "Ji",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/40 to-indigo-900/20",
      cardBorder: "border-blue-600/30",
    },
  },

  // ── Communication ──────────────────────────────────────────
  {
    hosts: ["slack.com"],
    service: {
      name: "Slack",
      badge: "Sl",
      badgeBg: "bg-purple-500/20",
      badgeText: "text-purple-400",
      cardGradient: "from-purple-900/35 to-fuchsia-900/20",
      cardBorder: "border-purple-700/30",
    },
  },
  {
    hosts: ["discord.com", "discord.gg"],
    service: {
      name: "Discord",
      badge: "Dc",
      badgeBg: "bg-indigo-500/20",
      badgeText: "text-indigo-400",
      cardGradient: "from-indigo-900/40 to-violet-900/20",
      cardBorder: "border-indigo-700/30",
    },
  },
  {
    hosts: ["zoom.us"],
    service: {
      name: "Zoom",
      badge: "Zm",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/40 to-sky-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["meet.google.com"],
    service: {
      name: "Google Meet",
      badge: "GM",
      badgeBg: "bg-green-500/20",
      badgeText: "text-green-400",
      cardGradient: "from-green-900/35 to-teal-900/20",
      cardBorder: "border-green-700/30",
    },
  },
  {
    hosts: ["calendly.com"],
    service: {
      name: "Calendly",
      badge: "Ca",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/35 to-indigo-900/20",
      cardBorder: "border-blue-600/30",
    },
  },

  // ── Social & Content ───────────────────────────────────────
  {
    hosts: ["twitter.com", "x.com"],
    service: {
      name: "X",
      badge: "X",
      badgeBg: "bg-gray-400/20",
      badgeText: "text-gray-200",
      cardGradient: "from-gray-800/50 to-slate-900/25",
      cardBorder: "border-gray-600/30",
    },
  },
  {
    hosts: ["linkedin.com"],
    service: {
      name: "LinkedIn",
      badge: "In",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/40 to-sky-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["reddit.com"],
    service: {
      name: "Reddit",
      badge: "Re",
      badgeBg: "bg-orange-500/20",
      badgeText: "text-orange-400",
      cardGradient: "from-orange-900/30 to-red-900/20",
      cardBorder: "border-orange-700/30",
    },
  },
  {
    hosts: ["medium.com"],
    service: {
      name: "Medium",
      badge: "M",
      badgeBg: "bg-gray-400/20",
      badgeText: "text-gray-200",
      cardGradient: "from-gray-800/50 to-slate-900/25",
      cardBorder: "border-gray-600/30",
    },
  },
  {
    hosts: ["substack.com"],
    service: {
      name: "Substack",
      badge: "Su",
      badgeBg: "bg-orange-500/20",
      badgeText: "text-orange-400",
      cardGradient: "from-orange-900/30 to-amber-900/20",
      cardBorder: "border-orange-700/30",
    },
  },
  {
    hosts: ["producthunt.com"],
    service: {
      name: "Product Hunt",
      badge: "PH",
      badgeBg: "bg-orange-500/20",
      badgeText: "text-orange-400",
      cardGradient: "from-orange-900/30 to-red-900/20",
      cardBorder: "border-orange-700/30",
    },
  },

  // ── Documents & Forms ──────────────────────────────────────
  {
    hosts: ["typeform.com"],
    service: {
      name: "Typeform",
      badge: "Tf",
      badgeBg: "bg-gray-400/20",
      badgeText: "text-gray-200",
      cardGradient: "from-gray-800/45 to-slate-900/20",
      cardBorder: "border-gray-600/30",
    },
  },
  {
    hosts: ["tally.so"],
    service: {
      name: "Tally",
      badge: "Ta",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-300",
      cardGradient: "from-blue-900/35 to-indigo-900/20",
      cardBorder: "border-blue-600/30",
    },
  },

  // ── DeSo ecosystem ────────────────────────────────────────
  {
    hosts: ["diamondapp.com"],
    service: {
      name: "Diamond",
      badge: "Di",
      badgeBg: "bg-cyan-500/20",
      badgeText: "text-cyan-400",
      cardGradient: "from-cyan-900/35 to-blue-900/20",
      cardBorder: "border-cyan-700/30",
    },
  },
  {
    hosts: ["desofy.app"],
    service: {
      name: "DeSofy",
      badge: "Df",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-400",
      cardGradient: "from-blue-900/40 to-indigo-900/20",
      cardBorder: "border-blue-600/30",
    },
  },
  {
    hosts: ["openfund.com"],
    service: {
      name: "Openfund",
      badge: "OF",
      badgeBg: "bg-emerald-500/20",
      badgeText: "text-emerald-400",
      cardGradient: "from-emerald-900/35 to-green-900/20",
      cardBorder: "border-emerald-700/30",
    },
  },
  {
    hosts: ["focus.xyz"],
    service: {
      name: "Focus",
      badge: "Fo",
      badgeBg: "bg-indigo-500/20",
      badgeText: "text-indigo-400",
      cardGradient: "from-indigo-900/35 to-violet-900/20",
      cardBorder: "border-indigo-700/30",
    },
  },
];

/**
 * Detect a known service from a URL.
 * Returns the service metadata or undefined for unknown URLs.
 */
export function detectLinkService(url: string): LinkService | undefined {
  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "");
    pathname = parsed.pathname;
  } catch {
    return undefined;
  }

  for (const pattern of SERVICES) {
    const hostMatch = pattern.hosts.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`)
    );
    if (!hostMatch) continue;
    if (pattern.pathPrefix && !pathname.startsWith(pattern.pathPrefix)) continue;
    return pattern.service;
  }

  return undefined;
}
