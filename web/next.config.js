/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/finance-hub',
  async redirects() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/',
          destination: '/finance-hub',
          permanent: false,
          basePath: false,
        },
      ]
    }
    return []
  },
  images: {
    domains: ['lh3.googleusercontent.com']
  }
}

module.exports = nextConfig
