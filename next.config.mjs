/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@prisma/client", "prisma", "bcrypt"],
};

export default nextConfig;