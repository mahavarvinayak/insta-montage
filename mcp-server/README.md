# 🚀 Insta Montage MCP Server

> **Model Context Protocol (MCP)** server for **Insta Montage** — give your AI Agent (in Claude Desktop, Cursor, VS Code, Windsurf, Codex, or Antigravity) **100% full control** over your Instagram publishing queue, local media automation, and analytics.

---

## ⚡ Features

- **📂 1-Click Local Folder Automation**: Point an AI Agent to a folder on your computer — it automatically scans, downscales/optimizes, uploads, and schedules all photos, carousels, and reels across custom times.
- **🖼️ Built-in Image Optimization (Sharp)**: Automatically converts images to Instagram standard JPEG (1080×1350 for portrait, 4:5 to 1.91:1 ratio), downscaling oversized 4K/300DPI images so Meta API never rejects them.
- **📝 Automatic Caption Extraction**: Reads companion `.txt` or `.md` files matching your image/folder names.
- **📅 Smart Batch Scheduling**: Schedule posts across custom intervals (e.g. every 4 hours, or daily at `10:00`, `14:00`, `18:00`, `21:00`).
- **📊 Real-time Analytics & Token Health**: Inspect follower growth, engagement rates, top posts, and Meta token status directly through AI prompts.
- **🗃️ Queue Management**: List queue, view execution logs, retry failed posts, force immediate publishing, or cancel scheduled posts.

---

## 🛠️ Installation & Setup

### 1. Build the MCP Server
In this directory:
```bash
cd mcp-server
npm install
npm run build
```

---

## 🔌 Configuration for AI Clients

### 1. Claude Desktop
Add to your `claude_desktop_config.json` (`%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "insta-montage": {
      "command": "node",
      "args": [
        "c:/Users/mahav/OneDrive - Government Engineering College, Dahod/Desktop/insta-montage/mcp-server/dist/index.js"
      ],
      "env": {
        "INSTA_MONTAGE_URL": "https://insta-montage.mahavarvinayak.workers.dev",
        "INSTA_MONTAGE_EMAIL": "admin@instamontage.local",
        "INSTA_MONTAGE_PASSWORD": "Vinayak#Montage!2026Secure",
        "TIMEZONE": "Asia/Kolkata"
      }
    }
  }
}
```

---

### 2. Cursor IDE
Create or edit `.cursor/mcp.json` in your workspace or global settings:

```json
{
  "mcpServers": {
    "insta-montage": {
      "command": "node",
      "args": [
        "c:/Users/mahav/OneDrive - Government Engineering College, Dahod/Desktop/insta-montage/mcp-server/dist/index.js"
      ],
      "env": {
        "INSTA_MONTAGE_URL": "https://insta-montage.mahavarvinayak.workers.dev",
        "INSTA_MONTAGE_EMAIL": "admin@instamontage.local",
        "INSTA_MONTAGE_PASSWORD": "Vinayak#Montage!2026Secure"
      }
    }
  }
}
```

---

### 3. VS Code / Windsurf / Codex
Configure in your IDE's MCP settings:
- **Server Name**: `insta-montage`
- **Command**: `node`
- **Args**: `["<absolute-path-to-repo>/mcp-server/dist/index.js"]`

---

## 🧰 Exposed MCP Tools

| Tool Name | Description | Key Arguments |
|---|---|---|
| `insta_batch_schedule_folder` | **1-Click Automation!** Scans a local folder, auto-resizes images, uploads to Cloudflare, and schedules all posts across days/times. | `folder_path`, `mode`, `start_date_time`, `interval_hours`, `daily_times`, `default_caption` |
| `insta_scan_media_folder` | Inspects a local folder and reports all ready-to-post candidates, file counts, and captions found. | `folder_path`, `mode` (`each_file_as_post` or `subfolders_as_carousels`) |
| `insta_create_post` | Creates and schedules (or immediately publishes) a single Photo, Carousel, or Reel from local file paths. | `local_files`, `caption`, `scheduled_at`, `publish_now` |
| `insta_upload_media` | Uploads and auto-resizes a local file to 1080x1350 JPEG. | `file_path` |
| `insta_list_posts` | Lists posts in queue filtered by status (`all`, `scheduled`, `published`, `failed`, `draft`). | `status`, `limit` |
| `insta_get_post_details` | Shows full post metadata and step-by-step publisher logs. | `post_id` |
| `insta_publish_now` | Triggers immediate publishing on the next worker tick. | `post_id` |
| `insta_retry_post` | Re-queues a failed post for automatic retry. | `post_id` |
| `insta_cancel_post` | Cancels a post and deletes its media from KV storage. | `post_id` |
| `insta_update_post` | Edits caption or scheduled publishing time of a post. | `post_id`, `caption`, `scheduled_at` |
| `insta_get_analytics` | Fetches live followers, engagement rate, average likes, and top posts. | *(none)* |
| `insta_get_status` | Checks Meta token health, permissions, and queue counts. | *(none)* |

---

## 💬 Prompts You Can Give Your AI Agent

Once connected, you can simply tell your AI Agent in plain English or Hindi:

1. **Batch Schedule an entire folder in 1 click:**
   > *"Bhai mere local folder `C:/Users/mahav/Desktop/insta-content` me 10 posts padi hain. Inko kal se daily subah 11 baje schedule kardo, captions matching text files se utha lena."*

2. **Publish a carousel immediately:**
   > *"Is folder ke 4 slides ko ek Carousel banao, caption likho 'How AI Agents Work', aur abhi publish kardo."*

3. **Check Queue & Health:**
   > *"Check karo queue me kitni posts scheduled hain aur agli post kab publish hogi."*

4. **Analytics Overview:**
   > *"Instagram analytics check karke batao latest follower count aur top performing posts ka report kya hai."*

