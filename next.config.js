/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
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
