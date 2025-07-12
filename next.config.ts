import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
   async rewrites() {
    return [
      {
        source: '/api/transportepublico/:path*',
        destination: 'https://api.montevideo.gub.uy/api/transportepublico/:path*',
      },
       {
        source: '/token',
        destination: 'https://mvdapi-auth.montevideo.gub.uy/token',
      },
    ]
  },
};

export default nextConfig;
