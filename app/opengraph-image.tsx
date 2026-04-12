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
        {/* Headline line 1 */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textAlign: 'center',
          }}
        >
          Your body is trained.
        </div>

        {/* Headline line 2 */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          Your mind isn't.
        </div>

        {/* Product name */}
        <div
          style={{
            fontSize: 22,
            color: '#666666',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Ask Elijah
        </div>
      </div>
    ),
    { ...size }
  )
}
