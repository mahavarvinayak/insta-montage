import type { Env } from "./env";
export const telegramConfigured = (env: Env) => !!(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim());

/**
 * Plain text on purpose: captions are user content and HTML parse_mode makes
 * Telegram reject messages containing "<" or "&".
 */
export async function notify(env: Env, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!telegramConfigured(env)) return { ok: false, error: "Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)." };
  try {
    const token = env.TELEGRAM_BOT_TOKEN!.trim();
    const chatId = env.TELEGRAM_CHAT_ID!.trim();
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    });
    const j: any = await r.json().catch(() => ({}));
    return j.ok ? { ok: true } : { ok: false, error: j.description || `HTTP ${r.status}` };
  } catch (e: any) { return { ok: false, error: e.message }; }
}
