import type { FrameRequest } from '@coinbase/onchainkit/frame';
import {
  getFrameHtmlResponse,
  getFrameMessage,
} from '@coinbase/onchainkit/frame';
import { NextResponse } from 'next/server';

import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { defaultErrorFrame, getBaseUrl } from '@/utils/Helpers';

export const POST = async (req: Request) => {
  const body: FrameRequest = await req.json();

  const { isValid, message } = await getFrameMessage(body, {
    neynarApiKey: Env.NEYNAR_API_KEY,
  });

  if (!isValid) {
    logger.info('Message not valid');
    return new NextResponse(defaultErrorFrame);
  }

  let state = {
    description: 'Processing',
  };
  try {
    state = JSON.parse(decodeURIComponent(message.state?.serialized));
  } catch (e) {
    return new NextResponse(defaultErrorFrame);
  }

  // async function updateScore() {
  //   const response = await axios.get(
  //     endpoint + `/registry/score/${scorerId}/${account}`,
  //     {
  //       headers: {
  //         "Content-Type": "application/json",
  //         "X-API-Key": apiKey,
  //       },
  //     }
  //   );
  //   const score = response.data;
  //   updateUiWithScore(score);
  //   if (score.status == "PROCESSING") {
  //     // Schedule another update
  //     setTimeout(updateScore, 1000);
  //   }
  // }
  // setTimeout(updateScore, 1000);

  return new NextResponse(
    getFrameHtmlResponse({
      buttons: [
        {
          action: 'link',
          label: 'Learn more',
          target: getBaseUrl(),
        },
      ],
      image: {
        src: `${getBaseUrl()}/api/og?title=Processing&subtitle=${state.description}&content=&url=https://i.imgur.com/k7EkTmI.png`,
      },
      ogDescription: 'Devcon 7 Raffle',
      ogTitle: 'Devcon 7 Raffle',
    }),
  );
};
