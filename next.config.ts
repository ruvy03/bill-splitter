import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma requires this so its engine file isn't bundled by the server build
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
