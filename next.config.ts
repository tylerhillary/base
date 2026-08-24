import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * Pin the tracing root to this project. Without it Next walks up looking for
   * a lockfile and can settle on the home directory, pulling unrelated files
   * into the build trace.
   */
  outputFileTracingRoot: projectRoot,
  poweredByHeader: false,
  compress: true,
  /*
   * firebase-admin resolves some of its dependencies at runtime, which the
   * bundler cannot follow. Leaving it external keeps it as a plain node_modules
   * require on the server, where it belongs.
   */
  serverExternalPackages: ["firebase-admin"],
  experimental: {
    // Only pull in the Firebase entry points a page actually imports.
    optimizePackageImports: ["firebase/auth", "firebase/firestore", "firebase/app"]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), interest-cohort=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
