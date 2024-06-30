import { getFrameHtmlResponse } from '@coinbase/onchainkit/frame';
import { NextResponse } from 'next/server';

import { getBaseUrl } from '@/utils/Helpers';

export const POST = async (/* req: Request */) => {
  // const url = new URL(req.url);
  // const dev = url.searchParams.get('dev') === 'true';

  return new NextResponse(
    getFrameHtmlResponse({
      buttons: [
        {
          action: 'link',
          label: 'See more',
          target: `https://raffle.devcon.org`,
        },
      ],
      image: {
        src: `${getBaseUrl()}/api/og?title=Devcon 7&subtitle=Congrats!&content=You bumped your bid!&url=https://i.imgur.com/k7EkTmI.png`,
      },
      // ...(dev && {
      //   input: {
      //     text: 'REQUIRED: Test wallet address',
      //   },
      // }),
      ogDescription: 'Raffle',
      ogTitle: 'Devcon 7',
      postUrl: `${getBaseUrl()}/api/frame`,
    }),
  );
};
