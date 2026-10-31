import type { Env } from "./env";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
const TTL_SECONDS = 172800; // 48 hours auto-expiration in KV engine

export interface MediaMeta {
  size: number;
  type: string;
  chunks: number;
  createdAt: string;
}

export async function putMedia(
  env: Env,
  type: string,
  declaredSize: number,
  body: ReadableStream | Blob
) {
  let buffer: Uint8Array;
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    buffer = new Uint8Array(await body.arrayBuffer());
  } else {
    const stream = body as ReadableStream;
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLen += value.byteLength;
      }
    }
    buffer = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
  }

  const size = buffer.byteLength;
  const isImg = type.startsWith("image/");
  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${isImg ? "jpg" : "mp4"}`;
  const numChunks = Math.ceil(size / CHUNK_SIZE) || 1;

  const meta: MediaMeta = {
    size,
    type,
    chunks: numChunks,
    createdAt: new Date().toISOString(),
  };

  // Store metadata
  await env.MEDIA_KV.put(`meta:${key}`, JSON.stringify(meta), { expirationTtl: TTL_SECONDS });

  // Store chunks
  for (let i = 0; i < numChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, size);
    const chunkData = buffer.subarray(start, end);
    await env.MEDIA_KV.put(`data:${key}:${i}`, chunkData, { expirationTtl: TTL_SECONDS });
  }

  const base = (env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  return {
    key,
    url: `/media/${key}`,
    absolute_url: /^https:\/\//i.test(base) ? `${base}/media/${key}` : null,
    type: isImg ? "image" : "video",
  };
}

export async function getMediaResponse(req: Request, env: Env, key: string): Promise<Response> {
  const metaRaw = await env.MEDIA_KV.get(`meta:${key}`);
  if (!metaRaw) return new Response("Not found", { status: 404 });

  let meta: MediaMeta;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return new Response("Corrupted media metadata", { status: 500 });
  }

  const h = new Headers();
  h.set("content-type", meta.type);
  h.set("etag", `"${key}"`);
  h.set("cache-control", "public, max-age=86400");
  h.set("accept-ranges", "bytes");
  h.set("access-control-allow-origin", "*");

  if (req.method === "HEAD") {
    h.set("content-length", String(meta.size));
    return new Response(null, { headers: h });
  }

  const rangeHeader = req.headers.get("range");
  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const parts = rangeHeader.replace("bytes=", "").split("-");
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : meta.size - 1;

    if (isNaN(start)) {
      start = Math.max(0, meta.size - end);
      end = meta.size - 1;
    }
    if (isNaN(end) || end >= meta.size) {
      end = meta.size - 1;
    }

    if (start > end || start >= meta.size) {
      return new Response("Requested range not satisfiable", {
        status: 416,
        headers: { "content-range": `bytes */${meta.size}` },
      });
    }

    const rangeLength = end - start + 1;
    h.set("content-range", `bytes ${start}-${end}/${meta.size}`);
    h.set("content-length", String(rangeLength));

    const startChunk = Math.floor(start / CHUNK_SIZE);
    const endChunk = Math.floor(end / CHUNK_SIZE);

    const out = new Uint8Array(rangeLength);
    let outOffset = 0;

    for (let c = startChunk; c <= endChunk; c++) {
      const chunkBuf = await env.MEDIA_KV.get(`data:${key}:${c}`, "arrayBuffer");
      if (!chunkBuf) return new Response("Missing media chunk", { status: 500 });
      const chunkArr = new Uint8Array(chunkBuf);
      const chunkStart = c * CHUNK_SIZE;

      const sliceStart = Math.max(0, start - chunkStart);
      const sliceEnd = Math.min(chunkArr.byteLength, end - chunkStart + 1);
      const needed = chunkArr.subarray(sliceStart, sliceEnd);
      out.set(needed, outOffset);
      outOffset += needed.byteLength;
    }

    return new Response(out, { status: 206, headers: h });
  }

  // Full response (no range)
  h.set("content-length", String(meta.size));
  if (meta.chunks === 1) {
    const chunkBuf = await env.MEDIA_KV.get(`data:${key}:0`, "arrayBuffer");
    if (!chunkBuf) return new Response("Missing media data", { status: 500 });
    return new Response(chunkBuf, { headers: h });
  }

  // Stream chunks
  const stream = new ReadableStream({
    async start(controller) {
      for (let c = 0; c < meta.chunks; c++) {
        const chunkBuf = await env.MEDIA_KV.get(`data:${key}:${c}`, "arrayBuffer");
        if (chunkBuf) controller.enqueue(new Uint8Array(chunkBuf));
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: h });
}

export async function deleteMediaFile(env: Env, key: string) {
  const metaRaw = await env.MEDIA_KV.get(`meta:${key}`);
  if (metaRaw) {
    try {
      const meta: MediaMeta = JSON.parse(metaRaw);
      for (let i = 0; i < meta.chunks; i++) {
        await env.MEDIA_KV.delete(`data:${key}:${i}`);
      }
    } catch {
      /* ignore */
    }
  }
  await env.MEDIA_KV.delete(`meta:${key}`);
}
