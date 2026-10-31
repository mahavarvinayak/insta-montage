const isDev = process.env.NODE_ENV !== "production";
/** @type {import('next').NextConfig} */
export default {
  output: isDev ? undefined : "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(isDev && { async rewrites() { return [
    { source: "/api/:path*", destination: "http://localhost:8787/api/:path*" },
    { source: "/media/:path*", destination: "http://localhost:8787/media/:path*" },
  ]; } }),
};
