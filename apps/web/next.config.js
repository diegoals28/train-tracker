/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@train-tracker/database"],
  output: "standalone",
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/.prisma/**/*"],
    },
  },
};

module.exports = nextConfig;
