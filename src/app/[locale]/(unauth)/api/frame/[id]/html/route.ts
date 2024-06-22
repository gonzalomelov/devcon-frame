import { getFrameHtmlResponse } from '@coinbase/onchainkit/frame';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { frameSchema } from '@/models/Schema';
import { defaultErrorFrame, getBaseUrl } from '@/utils/Helpers';

export const GET = async (req: Request) => {
  const urlParts = req.url.split('/');
  const idPart = urlParts[urlParts.length - 2];

  if (!idPart) {
    logger.info('Invalid URL structure', { idPart });
    return new NextResponse(defaultErrorFrame);
  }

  const frameId = parseInt(idPart, 10);

  if (Number.isNaN(frameId)) {
    logger.info('Invalid ID', { idPart });
    return new NextResponse(defaultErrorFrame);
  }

  const frames = await db
    .select()
    .from(frameSchema)
    .where(eq(frameSchema.id, frameId))
    .limit(1);

  if (frames.length === 0) {
    logger.info('Frame not found', { frameId });
    return new NextResponse(defaultErrorFrame);
  }

  const [frame] = frames;

  return new NextResponse(
    getFrameHtmlResponse({
      buttons: [
        {
          action: 'post',
          label: frame!.button,
          target: `${getBaseUrl()}/api/frame/${frameId}/action`,
        },
      ],
      image: {
        src: frame!.image,
      },
      input: {
        text: 'Wallet address to test',
      },
      ogDescription: frame!.title,
      ogTitle: 'Target Onchain',
      postUrl: `${getBaseUrl()}/api/frame`,
    }),
  );
};
