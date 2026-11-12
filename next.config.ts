import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  // Redirect before rendering, so /settings doesn't flash an empty page first.
  async redirects() {
    return [
      { source: "/w/:slug/settings", destination: "/w/:slug/settings/general", permanent: false },
    ];
  },
};

export default nextConfig;
