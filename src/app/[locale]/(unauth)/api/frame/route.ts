import { getFrameHtmlResponse } from '@coinbase/onchainkit/frame';
import { NextResponse } from 'next/server';
import { URL } from 'url';

import { getBaseUrl } from '@/utils/Helpers';

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const dev = url.searchParams.get('dev') === 'true';

  return new NextResponse(
    getFrameHtmlResponse({
      buttons: [
        {
          action: 'post',
          label: 'I want to participate!',
          target: `${getBaseUrl()}/api/frame/action`,
        },
      ],
      image: {
        src: `${getBaseUrl()}/api/og?title=Devcon 7&subtitle=Raffle&content=Time left 8d&url=https://i.imgur.com/k7EkTmI.png`,
      },
      ...(dev && {
        input: {
          text: 'REQUIRED: Test wallet address',
        },
      }),
      ogDescription: 'Raffle',
      ogTitle: 'Devcon 7',
      postUrl: `${getBaseUrl()}/api/frame`,
    }),
  );
};
