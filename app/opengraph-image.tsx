import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Ask Elijah — Your body is trained. Your mind isn\'t.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#000000',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '0 80px',
        }}
      >
        {/* Brand label */}
        <div
          style={{
            fontSize: 20,
            color: '#555555',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginBottom: 40,
          }}
        >
          Ask Elijah
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          Your body is trained.<br />Your mind isn't.
        </div>

        {/* What it does */}
        <div
          style={{
            fontSize: 24,
            color: '#888888',
            letterSpacing: '0.05em',
            textAlign: 'center',
          }}
        >
          NBA Champion · Ask a question. Get a personal answer.
        </div>
      </div>
    ),
    { ...size }
  )
}
