import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Finance Hub'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090f',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        </div>

        {/* Title */}
        <div style={{ fontSize: 64, fontWeight: 700, color: '#ffffff', letterSpacing: '-2px', marginBottom: 16 }}>
          Finance Hub
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 26, color: '#6b7280', textAlign: 'center', maxWidth: 600 }}>
          Track your net worth, recurring expenses,{'\n'}and income — all in one place.
        </div>

        {/* URL badge */}
        <div
          style={{
            marginTop: 48,
            padding: '10px 24px',
            borderRadius: 999,
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
            color: '#818cf8',
            fontSize: 18,
          }}
        >
          avivo.dev/finance-hub
        </div>
      </div>
    ),
    { ...size }
  )
}
