"use client";
import { useState } from "react";
import { 
  Bot, 
  Copy, 
  Check, 
  FolderSync, 
  Sparkles, 
  Terminal, 
  Cpu, 
  Zap, 
  Code2, 
  Layers, 
  FileSearch, 
  UploadCloud, 
  Send, 
  RotateCcw, 
  Trash2, 
  BarChart3, 
  Activity, 
  Clock, 
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { PageHeader, Button, cn } from "@/components/ui";

const MCP_PATH = "c:/Users/mahav/OneDrive - Government Engineering College, Dahod/Desktop/insta-montage/mcp-server/dist/index.js";
const BACKEND_URL = "https://insta-montage.mahavarvinayak.workers.dev";
const ADMIN_EMAIL = "admin@instamontage.local";

const CONFIGS = {
  claude: {
    title: "Claude Desktop",
    filename: "%APPDATA%\\Claude\\claude_desktop_config.json",
    description: "Add to your Claude Desktop configuration to enable full Instagram automation inside Claude chats.",
    json: JSON.stringify({
      mcpServers: {
        "insta-montage": {
          command: "node",
          args: [MCP_PATH],
          env: {
            INSTA_MONTAGE_URL: BACKEND_URL,
            INSTA_MONTAGE_EMAIL: ADMIN_EMAIL,
            INSTA_MONTAGE_PASSWORD: "Vinayak#Montage!2026Secure",
            TIMEZONE: "Asia/Kolkata"
          }
        }
      }
    }, null, 2)
  },
  cursor: {
    title: "Cursor IDE",
    filename: ".cursor/mcp.json",
    description: "Create or add to .cursor/mcp.json in your project or global Cursor settings.",
    json: JSON.stringify({
      mcpServers: {
        "insta-montage": {
          command: "node",
          args: [MCP_PATH],
          env: {
            INSTA_MONTAGE_URL: BACKEND_URL,
            INSTA_MONTAGE_EMAIL: ADMIN_EMAIL,
            INSTA_MONTAGE_PASSWORD: "Vinayak#Montage!2026Secure"
          }
        }
      }
    }, null, 2)
  },
  vscode: {
    title: "VS Code / Windsurf",
    filename: "Settings > MCP Servers",
    description: "Configure in your editor's MCP server manager or settings.json.",
    json: JSON.stringify({
      "insta-montage": {
        command: "node",
        args: [MCP_PATH],
        env: {
          INSTA_MONTAGE_URL: BACKEND_URL,
          INSTA_MONTAGE_EMAIL: ADMIN_EMAIL,
          INSTA_MONTAGE_PASSWORD: "Vinayak#Montage!2026Secure"
        }
      }
    }, null, 2)
  },
  cli: {
    title: "CLI / Terminal Test",
    filename: "PowerShell / Bash",
    description: "Test your MCP server directly via terminal or start the stdio worker process.",
    json: `cd "c:/Users/mahav/OneDrive - Government Engineering College, Dahod/Desktop/insta-montage/mcp-server"
node dist/index.js`
  }
};

const TOOLS = [
  {
    name: "insta_batch_schedule_folder",
    category: "automation",
    badge: "1-Click Magic",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: FolderSync,
    title: "Batch Schedule Folder",
    desc: "Scans a local folder on your computer, automatically downscales 4K/Canva images to standard 1080x1350 JPEG, reads companion .txt caption files, and schedules all posts across customized dates/times in 1 click.",
    params: [
      { name: "folder_path", type: "string", req: true, desc: "Path to local folder with media" },
      { name: "start_date_time", type: "string", req: false, desc: "e.g. 'tomorrow 10:00', '2026-11-04 14:00'" },
      { name: "interval_hours", type: "number", req: false, desc: "Hours between posts (default: 4)" },
      { name: "daily_times", type: "array", req: false, desc: "e.g. ['10:00', '14:00', '18:00', '21:00']" },
      { name: "default_caption", type: "string", req: false, desc: "Fallback caption if no .txt file found" }
    ]
  },
  {
    name: "insta_scan_media_folder",
    category: "automation",
    badge: "Scanner",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: FileSearch,
    title: "Scan Local Media",
    desc: "Inspects local directory and reports all candidate Carousels, Single Photos, and Reels with file counts, detected types, and found captions.",
    params: [
      { name: "folder_path", type: "string", req: true, desc: "Directory path to scan" },
      { name: "mode", type: "enum", req: false, desc: "'each_file_as_post' or 'subfolders_as_carousels'" }
    ]
  },
  {
    name: "insta_create_post",
    category: "creation",
    badge: "Creator",
    badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    icon: UploadCloud,
    title: "Create Post from Files",
    desc: "Create and schedule (or publish immediately) a Photo, Carousel, or Reel from local file paths directly. Automatically uploads and resizes.",
    params: [
      { name: "local_files", type: "array", req: false, desc: "List of local file paths" },
      { name: "caption", type: "string", req: false, desc: "Post caption and hashtags" },
      { name: "scheduled_at", type: "string", req: false, desc: "e.g. 'tomorrow 15:00' or ISO" },
      { name: "publish_now", type: "boolean", req: false, desc: "Publish immediately" }
    ]
  },
  {
    name: "insta_upload_media",
    category: "creation",
    badge: "Optimizer",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: Zap,
    title: "Upload & Auto-Optimize",
    desc: "Uploads single image/video to Cloudflare KV. Automatically enforces 4:5 to 1.91:1 aspect ratio, converts to JPEG, and caps at 1080x1350.",
    params: [
      { name: "file_path", type: "string", req: true, desc: "Local path to image or video" }
    ]
  },
  {
    name: "insta_list_posts",
    category: "queue",
    badge: "Queue",
    badgeColor: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    icon: Layers,
    title: "List Queue Posts",
    desc: "Returns posts filtered by status (all, scheduled, published, failed, draft) with thumbnail previews and schedule times.",
    params: [
      { name: "status", type: "enum", req: false, desc: "all, scheduled, published, failed, draft" },
      { name: "limit", type: "number", req: false, desc: "Max items to return (default: 50)" }
    ]
  },
  {
    name: "insta_publish_now",
    category: "queue",
    badge: "Action",
    badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    icon: Send,
    title: "Publish Immediately",
    desc: "Bypasses wait time and queues an existing draft or scheduled post to be published on the very next cron tick.",
    params: [
      { name: "post_id", type: "string", req: true, desc: "Post UUID" }
    ]
  },
  {
    name: "insta_retry_post",
    category: "queue",
    badge: "Retry",
    badgeColor: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    icon: RotateCcw,
    title: "Retry Failed Post",
    desc: "Re-queues a failed post for automatic retry and resets attempt count.",
    params: [
      { name: "post_id", type: "string", req: true, desc: "Post UUID" }
    ]
  },
  {
    name: "insta_cancel_post",
    category: "queue",
    badge: "Delete",
    badgeColor: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: Trash2,
    title: "Cancel Post & Clean Storage",
    desc: "Cancels a scheduled post and deletes its media from Cloudflare KV storage to free up quota.",
    params: [
      { name: "post_id", type: "string", req: true, desc: "Post UUID" }
    ]
  },
  {
    name: "insta_get_analytics",
    category: "analytics",
    badge: "Insights",
    badgeColor: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    icon: BarChart3,
    title: "Live Account Analytics",
    desc: "Fetches live Instagram followers count, engagement rate, average likes and comments, and top recent posts.",
    params: []
  },
  {
    name: "insta_get_status",
    category: "analytics",
    badge: "System",
    badgeColor: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    icon: Activity,
    title: "System & Token Health",
    desc: "Checks Meta Graph API token validity, expiration timestamp, connected account username, and upcoming scheduled queue metrics.",
    params: []
  }
];

const PROMPTS = [
  {
    title: "🚀 1-Click Batch Schedule Entire Folder",
    prompt: "Bhai mere local folder 'C:/Users/mahav/Desktop/insta-content' me 10 posts padi hain. Inko kal se daily subah 11:00 AM IST pe schedule kardo. Captions matching text files se utha lena.",
    hint: "Uses insta_batch_schedule_folder with auto image downscaling & text caption pairing."
  },
  {
    title: "📸 Create & Publish Carousel Instantly",
    prompt: "Is local folder ke 4 slides ko ek Carousel post banao. Caption likho 'A Chatbot Answers. An Agent Acts. #AI #Tech' aur abhi publish kardo.",
    hint: "Uploads local slides, creates Carousel container, and queues immediate publish."
  },
  {
    title: "🔍 Scan Content Folder & Plan Calendar",
    prompt: "Mera folder 'C:/Users/mahav/Desktop/graphics' scan karo aur batao kitni carousels aur single photos hain, aur inko agle 5 dino me kaise schedule karna best rahega?",
    hint: "Scans candidates and suggests an optimized posting calendar."
  },
  {
    title: "📊 Get Instagram Performance Report",
    prompt: "Insta Montage analytics check karo aur mujhe ek brief summary do: total followers, engagement rate, aur top 3 best performing posts with likes and comments.",
    hint: "Fetches live Graph API analytics and formats an executive breakdown."
  }
];

export default function McpPage() {
  const [tab, setTab] = useState<keyof typeof CONFIGS>("claude");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredTools = filterCat === "all" ? TOOLS : TOOLS.filter(t => t.category === filterCat);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader 
        title="MCP Server (AI Agent Integration)" 
        sub="Connect Insta Montage to Claude Desktop, Cursor, VS Code, or Windsurf for 1-click batch scheduling & full automation." 
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              MCP Server Ready (12 Tools)
            </span>
          </div>
        }
      />

      {/* Top Banner: Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase font-medium">Protocol</span>
          <div className="flex items-center gap-2 mt-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Model Context Protocol</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Official TypeScript SDK v1.20</p>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase font-medium">Cloud Backend</span>
          <div className="flex items-center gap-2 mt-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-sm truncate">Cloudflare Worker</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">{BACKEND_URL}</p>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase font-medium">Image Optimizer</span>
          <div className="flex items-center gap-2 mt-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <span className="font-semibold text-sm">Sharp Engine</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Auto 1080x1350 JPEG & Ratio</p>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground uppercase font-medium">Local Path</span>
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="font-mono text-xs truncate">.../mcp-server/dist/index.js</span>
            <button 
              onClick={() => copy(MCP_PATH, "path")} 
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Copy absolute path"
            >
              {copiedKey === "path" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Ready to run via Node 20+</p>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" />
              Client Setup Configuration
            </h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Copy and paste this config snippet into your IDE or AI assistant config file.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {(["claude", "cursor", "vscode", "cli"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {CONFIGS[key].title}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono bg-muted px-2 py-0.5 rounded border border-border">
              {CONFIGS[tab].filename}
            </span>
            <Button
              variant="outline"
              onClick={() => copy(CONFIGS[tab].json, "config")}
              className="h-7 text-xs gap-1.5"
            >
              {copiedKey === "config" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Configuration
                </>
              )}
            </Button>
          </div>

          <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto border border-border leading-relaxed">
            {CONFIGS[tab].json}
          </pre>
          <p className="text-xs text-muted-foreground">{CONFIGS[tab].description}</p>
        </div>
      </div>

      {/* 1-Click Workflow Showcase */}
      <div className="card p-6 bg-gradient-to-br from-card to-primary/5 border-primary/20">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <Sparkles className="h-4 w-4" />
          How the 1-Click Local Automation Works
        </div>
        <p className="text-[13px] text-muted-foreground mt-1">
          You don&apos;t need to manually upload images one by one through the dashboard anymore. Let your AI pair-programmer automate everything:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="p-3.5 rounded-lg bg-card/60 border border-border/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center">1</span>
              <span className="text-sm font-medium">Keep Images in a Folder</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Put your Canva graphics, slides, or videos in any local folder (e.g. <code>Desktop/posts</code>). Optionally keep a matching <code>.txt</code> file for captions.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-card/60 border border-border/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center">2</span>
              <span className="text-sm font-medium">Give 1 Simple AI Prompt</span>
            </div>
            <p className="text-xs text-muted-foreground">
              In Claude or Cursor, simply say: <em>&quot;Schedule all posts in this folder starting tomorrow at 11 AM daily.&quot;</em>
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-card/60 border border-border/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold grid place-items-center">3</span>
              <span className="text-sm font-medium">Auto-Optimized & Scheduled</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The MCP server downscales oversized 4K images to 1080x1350 JPEG, uploads to Cloudflare KV, and schedules the queue automatically!
            </p>
          </div>
        </div>
      </div>

      {/* Prompts Gallery */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            Ready-to-Use AI Prompts (Copy & Paste)
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Click copy on any of these prompts and paste them into Claude Desktop or Cursor chat.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROMPTS.map((p, idx) => (
            <div key={idx} className="card p-4 flex flex-col justify-between space-y-3">
              <div>
                <span className="font-semibold text-[13px]">{p.title}</span>
                <p className="text-xs font-mono bg-muted/60 p-2.5 rounded border border-border mt-2 text-foreground/90 leading-relaxed">
                  &quot;{p.prompt}&quot;
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">{p.hint}</p>
              </div>

              <div className="flex justify-end pt-1">
                <Button 
                  variant="outline" 
                  onClick={() => copy(p.prompt, `prompt-${idx}`)} 
                  className="h-7 text-xs gap-1.5"
                >
                  {copiedKey === `prompt-${idx}` ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      Copied Prompt!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy Prompt
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tools Explorer */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              Exposed MCP Tools Catalog ({filteredTools.length})
            </h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Tools available to the LLM agent via Model Context Protocol.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start sm:self-auto">
            {["all", "automation", "creation", "queue", "analytics"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors",
                  filterCat === cat ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div key={tool.name} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{tool.title}</h3>
                      <span className="font-mono text-[11px] text-muted-foreground">{tool.name}</span>
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", tool.badgeColor)}>
                    {tool.badge}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tool.desc}
                </p>

                {tool.params.length > 0 && (
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-[11px] text-muted-foreground uppercase font-medium">Parameters</span>
                    <div className="mt-1.5 space-y-1">
                      {tool.params.map(p => (
                        <div key={p.name} className="flex items-baseline justify-between text-xs">
                          <span className="font-mono text-[11px] text-foreground">
                            {p.name} {p.req && <span className="text-destructive">*</span>}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{p.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

