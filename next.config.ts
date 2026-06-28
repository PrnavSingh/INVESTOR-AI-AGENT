import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel-ready: no special config needed for App Router + SSE streaming.
  // Vercel's Edge & Serverless runtimes handle ReadableStream natively.
  serverExternalPackages: ["yahoo-finance2"],
};

export default nextConfig;
