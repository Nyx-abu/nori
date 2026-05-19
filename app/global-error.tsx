'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ background: '#FDFBF7', color: '#1A1A1A', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 720, margin: '6rem auto', padding: '2rem' }}>
          <div style={{ border: '4px solid #1A1A1A', background: '#FFFFFF', padding: '2rem', boxShadow: '6px 6px 0px #1A1A1A', borderRadius: 16 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Something went wrong.</h2>
            <p style={{ marginTop: '0.5rem', fontWeight: 700, color: '#4A4A4A' }}>
              {error.message || 'A critical error occurred.'}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: '1.5rem',
                border: '2px solid #1A1A1A',
                background: '#2A4B3C',
                color: '#FFFFFF',
                fontWeight: 800,
                padding: '0.75rem 1.5rem',
                borderRadius: 9999,
                boxShadow: '3px 3px 0px #1A1A1A',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
