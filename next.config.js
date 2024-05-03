/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Production server does not install devDependencies
    // including @types/*.
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/metrics",
        destination: "/api/prometheus",
      },
    ];
  },
};

module.exports = nextConfig;
