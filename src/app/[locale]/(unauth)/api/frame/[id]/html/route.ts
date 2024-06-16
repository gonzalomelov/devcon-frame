import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { frameSchema } from '@/models/Schema';
import { getBaseUrl } from '@/utils/Helpers';

interface Button {
  text: string;
  action: 'link' | 'post';
  url: string;
}

const pageFromTemplate = (
  imageUrl: string,
  title: string,
  body: string,
  buttons: Button[] = [],
): string => {
  const buttonMetaTags = buttons
    .map((button, index) => {
      const buttonNumber = index + 1;
      return `
      <meta property='fc:frame:button:${buttonNumber}' content='${button.text}' />
      <meta property='fc:frame:button:${buttonNumber}:action' content='${button.action}' />
      <meta property='fc:frame:button:${buttonNumber}:target' content='${button.url}' />
      <meta property='fc:frame:button:${buttonNumber}:post_url' content='${button.url}' />
    `;
    })
    .join('\n');

  return `
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='utf-8' />
    <meta name='viewport' content='width=device-width, initial-scale=1' />
    <meta name='next-size-adjust' />
    <meta property='fc:frame' content='vNext' />
    <meta property='fc:frame:image' content='${imageUrl}' />
    ${buttonMetaTags}
    <meta property='og:title' content='${title}' />
    <meta property='og:image' content='${imageUrl}' />
    <title>${title}</title>
</head>
<body>
    ${body}
</body>
</html>
  `;
};

const mainPageBody = `
    <div>
        <h1>
          Help build a trustful decentralized identity infrastructure ⛓️
        </h1>
        <p>
          Verify your Farcaster account and claim your Gitcoin Passport stamp to improve your humanity and reputation score!
        </p>
        <p>
            Go to <a href='https://warpcast.com/ceciliaeiraldi92/0x984ee840'>Warpcast</a> and complete the steps directly on the Frame!
        </p>
    </div>
`;

export const GET = async (request: Request) => {
  const urlParts = request.url.split('/');
  const idPart = urlParts[urlParts.length - 2];

  if (!idPart) {
    return new NextResponse('Invalid URL structure', { status: 400 });
  }

  const frameId = parseInt(idPart, 10);

  if (Number.isNaN(frameId)) {
    return new NextResponse('Invalid ID', { status: 400 });
  }

  try {
    const frames = await db
      .select()
      .from(frameSchema)
      .where(eq(frameSchema.id, frameId))
      .limit(1);

    if (frames.length === 0) {
      return new NextResponse('Frame not found', { status: 404 });
    }

    const [frame] = frames;

    const buttons: Button[] = [
      {
        text: frame!.button,
        action: 'post',
        url: `${getBaseUrl()}/api/frame/${frameId}/action`,
      },
    ];

    const htmlContent = pageFromTemplate(
      frame!.image,
      'Target Onchain',
      mainPageBody,
      buttons,
    );

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    logger.error(error, 'An error occurred while retrieving the frame');

    return NextResponse.json({}, { status: 500 });
  }
};
