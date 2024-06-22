import type {
  FrameButtonMetadata,
  FrameRequest,
} from '@coinbase/onchainkit/frame';
import {
  getFrameHtmlResponse,
  getFrameMessage,
} from '@coinbase/onchainkit/frame';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { frameSchema, productSchema } from '@/models/Schema';
import { defaultErrorFrame, getBaseUrl } from '@/utils/Helpers';

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

  const dev = !!message?.input;

  accountAddress =
    message?.input ?? message?.interactor?.verified_accounts?.[0] ?? '';

  // Get frame
  const url = new URL(req.url);
  const urlParts = url.pathname.split('/');
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

  // Get onchain data
  const valid = await verifyReceiptsRunningAttestation(accountAddress);

  // Get products
  const products = await db
    .select()
    .from(productSchema)
    .where(eq(productSchema.shop, frame!.shop));

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

  const buttons: [FrameButtonMetadata, ...FrameButtonMetadata[]] = [
    {
      action: 'link',
      label: 'View',
      target: `https://${frame!.shop}/products/${recommendedProduct!.handle}`,
    },
  ];

  // const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(
  //   recommendedProduct!.variantId,
  // );

  // if (match) {
  if (recommendedProduct!.variantId) {
    buttons.push({
      action: 'link',
      label: 'Buy',
      target: `https://${frame!.shop}/cart/${recommendedProduct!.variantId}:1`,
    });
  }

  if (dev) {
    buttons.push({
      action: 'post',
      label: 'Explain',
      target: `${getBaseUrl()}/api/frame/${frameId}/explain`,
    });
  }

  return new NextResponse(
    getFrameHtmlResponse({
      buttons,
      image: {
        src: `${getBaseUrl()}/api/og?title=${recommendedProduct!.title}&subtitle=${recommendedProduct!.description}&content=$100&url=${recommendedProduct!.image}&width=600`,
      },
      ogDescription: recommendedProduct!.title,
      ogTitle: 'Target Onchain',
      postUrl: `${getBaseUrl()}/api/frame`,
      ...(dev && {
        state: {
          description: valid
            ? `Attestation found on Receipts.xyz for ${accountAddress}`
            : `No attestation found on Receipts.xyz for ${accountAddress}. A random product is recommended.`,
        },
      }),
    }),
  );
};
