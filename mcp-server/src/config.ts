export interface AppConfig {
  baseUrl: string;
  email: string;
  password: string;
  timezone: string;
}

export function getConfig(): AppConfig {
  const baseUrl = (process.env.INSTA_MONTAGE_URL || "https://insta-montage.mahavarvinayak.workers.dev").trim().replace(/\/+$/, "");
  const email = (process.env.INSTA_MONTAGE_EMAIL || "admin@instamontage.local").trim();
  const password = process.env.INSTA_MONTAGE_PASSWORD || "Vinayak#Montage!2026Secure";
  const timezone = process.env.TIMEZONE || "Asia/Kolkata";

  return { baseUrl, email, password, timezone };
}
