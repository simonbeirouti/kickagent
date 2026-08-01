import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // a stray lockfile in the home directory makes Next.js mis-infer the
  // workspace root; pin it to this project
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
