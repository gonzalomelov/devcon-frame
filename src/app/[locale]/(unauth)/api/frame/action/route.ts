import type {
  FrameButtonMetadata,
  FrameRequest,
} from '@coinbase/onchainkit/frame';
import {
  getFrameHtmlResponse,
  getFrameMessage,
} from '@coinbase/onchainkit/frame';
import { NextResponse } from 'next/server';

import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import {
  defaultErrorFrame,
  getBaseUrl,
  hasBidsFromAddress,
} from '@/utils/Helpers';

export const POST = async (req: Request) => {
  // Validate frame and get account address
  let accountAddress: string | undefined = '';

  const body: FrameRequest = await req.json();

  const { isValid, message } = await getFrameMessage(body, {
    neynarApiKey: Env.NEYNAR_API_KEY,
  });

  if (!isValid) {
    logger.info('Message not valid');
    return new NextResponse(defaultErrorFrame);
  }

  const hasFinished = true;

  if (hasFinished) {
    const buttons: [FrameButtonMetadata, ...FrameButtonMetadata[]] = [
      {
        action: 'link',
        label: 'Visit',
        target: 'https://devcon.org',
      },
    ];

    const frameHtmlResponse = getFrameHtmlResponse({
      buttons,
      image: {
        src: 'https://devcon.org/assets/images/dc7-og.png',
      },
      ogDescription: 'Devcon 7',
      ogTitle: 'Devcon 7',
      postUrl: `${getBaseUrl()}/api/frame`,
    });

    return new NextResponse(frameHtmlResponse);
  }

  // const dev = !!message?.input;

  accountAddress =
    message?.input ?? message?.interactor?.verified_accounts?.[0] ?? '';

  const hasBids = await hasBidsFromAddress(accountAddress);

  if (hasBids) {
    const buttons: [FrameButtonMetadata, ...FrameButtonMetadata[]] = [
      {
        action: 'tx',
        label: 'Bump',
        target: `${getBaseUrl()}/api/frame/bid`,
      },
    ];

    const frameHtmlResponse = getFrameHtmlResponse({
      buttons,
      image: {
        src: `${getBaseUrl()}/api/og?title=Bump your bid&subtitle=Min. increment of the bid 0.003 ETH&content=&url=https://i.imgur.com/k7EkTmI.png`,
      },
      ogDescription: 'Processing',
      ogTitle: 'Devcon 7 Raffle',
      postUrl: `${getBaseUrl()}/api/frame/aftertx`,
    });

    return new NextResponse(frameHtmlResponse);
  }

  try {
    const endpoint = 'https://api.scorer.gitcoin.co';
    const response = await fetch(`${endpoint}/registry/submit-passport`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': Env.GC_API_KEY,
      },
      body: JSON.stringify({
        address: accountAddress,
        community: Env.GC_SCORER_ID,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const score = await response.json();

    if (!score) {
      // Send to Retry frame
      return new NextResponse(defaultErrorFrame);
    }

    if (score.status === 'PROCESSING') {
      const buttons: [FrameButtonMetadata, ...FrameButtonMetadata[]] = [
        {
          action: 'post',
          label: 'Explain',
          target: `${getBaseUrl()}/api/frame/refresh`,
        },
      ];

      const frameHtmlResponse = getFrameHtmlResponse({
        buttons,
        image: {
          src: `${getBaseUrl()}/api/og?title=Processing&subtitle=Refresh in a couple of seconds.&content=&url=https://i.imgur.com/k7EkTmI.png`,
        },
        ogDescription: 'Processing',
        ogTitle: 'Devcon 7 Raffle',
        postUrl: `${getBaseUrl()}/api/frame`,
      });

      return new NextResponse(frameHtmlResponse);
    }

    if (score.status === 'ERROR') {
      // passportScoreDisplay.innerHTML = `${new Date()} <br>Error: ${
      //   score.error
      // }`;

      // Send to Retry frame
      return new NextResponse(defaultErrorFrame);
    }

    if (score.status === 'DONE') {
      if (score.score < 20) {
        const buttons: [FrameButtonMetadata, ...FrameButtonMetadata[]] = [
          {
            action: 'link',
            label: 'Increase my score',
            target: `https://passport.gitcoin.co`,
          },
          {
            action: 'post',
            label: 'Recalculate',
            target: `${getBaseUrl()}/api/frame/action`,
          },
        ];

        const frameHtmlResponse = getFrameHtmlResponse({
          buttons,
          image: {
            src: `${getBaseUrl()}/api/og?title=Score&subtitle=${score.score}&content=Your score is too low!&url=https://i.imgur.com/k7EkTmI.png`,
          },
          ogDescription: 'Score',
          ogTitle: 'Devcon 7 Raffle',
          postUrl: `${getBaseUrl()}/api/frame`,
          // ...(dev && {
          //   state: {
          //     description: customExplanation,
          //   },
          // }),
        });

        return new NextResponse(frameHtmlResponse);
      }

      const buttons: [FrameButtonMetadata, ...FrameButtonMetadata[]] = [
        {
          action: 'link',
          label: 'Place bid',
          target: `https://raffle.devcon.org`,
        },
      ];

      const frameHtmlResponse = getFrameHtmlResponse({
        buttons,
        image: {
          src: `${getBaseUrl()}/api/og?title=Score&subtitle=${score.score}&content=Your can place your bid now!&url=https://i.imgur.com/k7EkTmI.png`,
        },
        ogDescription: 'Score',
        ogTitle: 'Devcon 7 Raffle',
        postUrl: `${getBaseUrl()}/api/frame`,
        // ...(dev && {
        //   state: {
        //     description: customExplanation,
        //   },
        // }),
      });

      return new NextResponse(frameHtmlResponse);
    }

    // Send to Retry frame
    return new NextResponse(defaultErrorFrame);
  } catch (error) {
    // Navigate to Retry

    return new NextResponse(defaultErrorFrame);
  }
};
