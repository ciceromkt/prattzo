/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;
const videoHost = process.env.NEXT_PUBLIC_VIDEO_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_VIDEO_BASE_URL).hostname
  : undefined;

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@prattzo/core", "@prattzo/db", "@prattzo/ui"],
  images: {
    remotePatterns: [supabaseHost, videoHost]
      .filter(Boolean)
      .map((hostname) => ({ protocol: "https", hostname })),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
