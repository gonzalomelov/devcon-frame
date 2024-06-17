import { ImageResponse } from 'next/og';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') || '';
  const title = searchParams.get('title') || '';
  const subtitle = searchParams.get('subtitle') || '';
  const content = searchParams.get('content') || '';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: '#fff',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
          }}
        >
          <img src={url} alt="Product Frame" width={600} height={630} />
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            fontSize: 32,
            fontWeight: 600,
          }}
        >
          <div
            style={{
              marginTop: 40,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div>{title}</div>
            <div style={{ fontSize: 24, fontWeight: 400, marginTop: 20 }}>
              {subtitle}
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, marginTop: 10 }}>
              {content}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
