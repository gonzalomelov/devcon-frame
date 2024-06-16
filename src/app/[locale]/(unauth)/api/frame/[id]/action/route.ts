import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { frameSchema, productSchema } from '@/models/Schema';
import { FarcasterMessageValidation } from '@/validations/FarcasterMessageValidation';

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

interface Button {
  text: string;
  action: 'link' | 'post';
  url: string;
}

const pageFromTemplateWithButtons = (
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

export type Attestation = {
  recipient: string;
  revocationTime: number;
  revoked: boolean;
  expirationTime: number;
  schema: {
    id: string;
  };
  decodedDataJson: string;
};

export type EASQueryResponse = {
  data?: {
    attestations: Attestation[];
  };
};

const verifyReceiptsRunningAttestation = async (
  address: string,
): Promise<boolean> => {
  const query = `
    query Attestations {
      attestations(
        where: {
          schemaId: { equals: "${Env.RECEIPTS_XYZ_NEW_USER_SCHEMA}" },
          attester: { equals: "${Env.RECEIPTS_XYZ_ATTESTER}" },
          recipient: { equals: "${address}" }
        }
      ) {
        id
        attester
        recipient
        refUID
        revocable
        revocationTime
        revoked
        expirationTime
        data
        schema {
          id
        }
      }
    }
  `;

  const response = await fetch(Env.BASE_EAS_SCAN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const result: EASQueryResponse = await response.json();

  const validAttestations = (result.data!.attestations || []).filter(
    (attestation) =>
      attestation.revocationTime === 0 &&
      attestation.expirationTime === 0 &&
      attestation.schema.id === Env.RECEIPTS_XYZ_NEW_USER_SCHEMA,
  );

  return validAttestations.length > 0;
};

export const POST = async (request: Request) => {
  const json = await request.json();

  const parse = FarcasterMessageValidation.safeParse(json);

  if (!parse.success) {
    return NextResponse.json(parse.error.format(), { status: 422 });
  }

  // Get the user wallet
  const response = await fetch(`${Env.NEYNAR_URL}/farcaster/frame/validate`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      api_key: Env.NEYNAR_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      cast_reaction_context: true,
      follow_context: true,
      signer_context: true,
      message_bytes_in_hex: parse.data.trustedData.messageBytes,
    }),
  });

  const trustedData = await response.json();

  const {
    action: {
      url,
      interactor: {
        // fid,
        verified_addresses: { eth_addresses: ethAddresses },
      },
    },
  } = trustedData;

  const urlParts = url.split('/');
  const idPart = urlParts[urlParts.length - 2];

  if (!idPart) {
    return new NextResponse('Invalid URL structure', { status: 400 });
  }

  const frameId = parseInt(idPart, 10);

  if (Number.isNaN(frameId)) {
    return new NextResponse('Invalid ID', { status: 400 });
  }

  const frames = await db
    .select()
    .from(frameSchema)
    .where(eq(frameSchema.id, frameId))
    .limit(1);

  if (frames.length === 0) {
    return new NextResponse('Frame not found', { status: 404 });
  }

  const [frame] = frames;

  // Get onchain data
  const valid = await verifyReceiptsRunningAttestation(ethAddresses[0]!);

  // Get products
  const products = await db.select().from(productSchema);

  // Recommend product/s based on onchain data
  let recommendedProduct;
  if (valid) {
    recommendedProduct = products.find((product) =>
      /Run|Running|Jog/i.test(product.description),
    );
    if (!recommendedProduct) {
      const randomIndex = Math.floor(Math.random() * products.length);
      recommendedProduct = products[randomIndex];
    }
  } else {
    const randomIndex = Math.floor(Math.random() * products.length);
    recommendedProduct = products[randomIndex];
  }

  const buttons: Button[] = [
    {
      text: 'View',
      action: 'link',
      url: `https://${frame!.shop}/products/${recommendedProduct!.handle}`,
    },
    {
      text: 'Buy',
      action: 'link',
      url: `https://${frame!.shop}/products/${recommendedProduct!.handle}`,
    },
  ];

  const htmlContent = pageFromTemplateWithButtons(
    recommendedProduct!.image,
    recommendedProduct!.title,
    mainPageBody,
    buttons,
  );

  return new NextResponse(htmlContent, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
};
