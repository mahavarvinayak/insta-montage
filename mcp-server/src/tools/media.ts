import fs from "fs/promises";
import path from "path";
import { InstaMontageClient } from "../client.js";
import { processMediaFile, isImageFile, isVideoFile } from "../optimizer.js";

export interface ScannedPostCandidate {
  type: "PHOTO" | "CAROUSEL" | "REEL";
  name: string;
  files: string[];
  caption?: string;
  hasVideo: boolean;
  fileCount: number;
}

export async function scanMediaFolder(folderPath: string, mode: "each_file_as_post" | "subfolders_as_carousels" = "each_file_as_post"): Promise<ScannedPostCandidate[]> {
  const resolved = path.resolve(folderPath);
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const candidates: ScannedPostCandidate[] = [];

  if (mode === "subfolders_as_carousels") {
    // Each subfolder represents a post (e.g. folder "post_ai_tips" with 5 slides and caption.txt)
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDirPath = path.join(resolved, entry.name);
        const subFiles = await fs.readdir(subDirPath);
        const mediaFiles: string[] = [];
        let caption: string | undefined;

        for (const f of subFiles) {
          const fullPath = path.join(subDirPath, f);
          const ext = path.extname(f).toLowerCase();
          if (isImageFile(fullPath) || isVideoFile(fullPath)) {
            mediaFiles.push(fullPath);
          } else if (ext === ".txt" || ext === ".md") {
            caption = (await fs.readFile(fullPath, "utf-8")).trim();
          }
        }

        if (mediaFiles.length > 0) {
          // Sort files naturally (e.g. 1.jpg, 2.jpg, 10.jpg)
          mediaFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
          const hasVideo = mediaFiles.some(f => isVideoFile(f));
          candidates.push({
            type: hasVideo ? "REEL" : mediaFiles.length > 1 ? "CAROUSEL" : "PHOTO",
            name: entry.name,
            files: mediaFiles,
            caption,
            hasVideo,
            fileCount: mediaFiles.length,
          });
        }
      }
    }
  }

  // Scan files directly inside folder
  const directFiles: string[] = [];
  const textMap = new Map<string, string>();

  for (const entry of entries) {
    if (entry.isFile()) {
      const fullPath = path.join(resolved, entry.name);
      const ext = path.extname(entry.name).toLowerCase();
      const baseName = path.basename(entry.name, ext);

      if (isImageFile(fullPath) || isVideoFile(fullPath)) {
        directFiles.push(fullPath);
      } else if (ext === ".txt" || ext === ".md") {
        textMap.set(baseName, (await fs.readFile(fullPath, "utf-8")).trim());
      }
    }
  }

  directFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  if (mode === "each_file_as_post") {
    for (const f of directFiles) {
      const ext = path.extname(f);
      const base = path.basename(f, ext);
      const isVid = isVideoFile(f);
      candidates.push({
        type: isVid ? "REEL" : "PHOTO",
        name: base,
        files: [f],
        caption: textMap.get(base) || textMap.get("caption"),
        hasVideo: isVid,
        fileCount: 1,
      });
    }
  } else if (candidates.length === 0 && directFiles.length > 0) {
    // If subfolders mode was requested but files are in root, treat root media as a single carousel/reel
    const hasVideo = directFiles.some(f => isVideoFile(f));
    candidates.push({
      type: hasVideo ? "REEL" : directFiles.length > 1 ? "CAROUSEL" : "PHOTO",
      name: path.basename(resolved),
      files: directFiles,
      caption: textMap.get("caption") || textMap.values().next().value,
      hasVideo,
      fileCount: directFiles.length,
    });
  }

  return candidates;
}

export async function uploadLocalMediaFile(client: InstaMontageClient, filePath: string) {
  const resolved = path.resolve(filePath);
  const processed = await processMediaFile(resolved);
  const uploadRes = await client.uploadMedia(processed);

  return {
    ...uploadRes,
    originalFile: resolved,
    wasOptimized: processed.wasOptimized,
    originalSize: processed.originalSize,
    finalSize: processed.size,
    dimensions: processed.width && processed.height ? `${processed.width}x${processed.height}` : undefined,
  };
}

