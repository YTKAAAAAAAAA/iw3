/** Headers that do not depend on the request. The Content-Security-Policy for
 *  pages needs a per-request nonce and is set in proxy.ts. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  // Browsers ignore HSTS over plain HTTP, so local development is unaffected.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // JSON and stored photos never need to run script or be framed.
        source: '/api/:path*',
        headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox" }],
      },
    ]
  },
}

export default nextConfig
