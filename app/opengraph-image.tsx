import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Ask Elijah — Train Your Mind'
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
        }}
      >
        {/* Three-dot logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0px', marginBottom: '48px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'white' }} />
          <div style={{ width: 36, height: 4, background: 'white', margin: '0 4px' }} />
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'white' }} />
          <div style={{ width: 36, height: 4, background: 'white', margin: '0 4px' }} />
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'white' }} />
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
            marginBottom: 20,
          }}
        >
          ASK ELIJAH
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: '#888888',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          NBA · EuroLeague Champion
        </div>
      </div>
    ),
    { ...size }
  )
}
