import type {
  FrameButtonMetadata,
  FrameRequest,
} from '@coinbase/onchainkit/frame';
import {
  getFrameHtmlResponse,
  getFrameMessage,
} from '@coinbase/onchainkit/frame';
import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
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

export type QueryResponse = {
  data?: {
    attestations: Attestation[];
  };
};

const validAttestations = async (
  address: string,
  schema: string,
  attester: string,
): Promise<Attestation[]> => {
  // // ############# USE EAS #############
  const query = `
    query Attestations {
      attestations(
        where: {
          schemaId: { equals: "${schema}" },
          attester: { equals: "${attester}" },
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

  const result: QueryResponse = await response.json();

  const attestations = result.data!.attestations || [];
  // // ############# USE EAS #############

  const filteredAttestations = attestations.filter(
    (attestation: Attestation) =>
      attestation.revocationTime === 0 &&
      attestation.expirationTime === 0 &&
      attestation.schema.id === schema,
  );

  return filteredAttestations;
};

const verifyReceiptsRunningAttestation = async (
  address: string,
): Promise<{ valid: boolean; data: any }> => {
  const attestations = await validAttestations(
    address,
    Env.RECEIPTS_XYZ_ALL_TIME_RUNNING_SCHEMA,
    Env.RECEIPTS_XYZ_ATTESTER,
  );
  return {
    valid: attestations.length >= 10,
    data: { count: attestations.length },
  };
};

const verifyCoinbaseOnchainVerificationCountryResidenceAttestation = async (
  address: string,
): Promise<{ valid: boolean; data: any }> => {
  const attestations = await validAttestations(
    address,
    Env.COINBASE_ONCHAIN_VERIFICATION_COUNTRY_RESIDENCE_SCHEMA,
    Env.COINBASE_ONCHAIN_VERIFICATION_ATTESTER,
  );
  return {
    valid: attestations.length > 0,
    data: { attestation: attestations[0] },
  };
};

const verifyCoinbaseOnchainVerificationAccountAttestation = async (
  address: string,
): Promise<{ valid: boolean; data: any }> => {
  const attestations = await validAttestations(
    address,
    Env.COINBASE_ONCHAIN_VERIFICATION_ACCOUNT_SCHEMA,
    Env.COINBASE_ONCHAIN_VERIFICATION_ATTESTER,
  );
  return {
    valid: attestations.length > 0,
    data: { attestation: attestations[0] },
  };
};

const verifyCoinbaseOnchainVerificationOneAttestation = async (
  address: string,
): Promise<{ valid: boolean; data: any }> => {
  const attestations = await validAttestations(
    address,
    Env.COINBASE_ONCHAIN_VERIFICATION_ONE_SCHEMA,
    Env.COINBASE_ONCHAIN_VERIFICATION_ATTESTER,
  );
  return {
    valid: attestations.length > 0,
    data: { attestation: attestations[0] },
  };
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
  let valid;
  let data;
  let explanation;
  if (frame?.matchingCriteria === 'RECEIPTS_XYZ_ALL_TIME_RUNNING') {
    const verification = await verifyReceiptsRunningAttestation(accountAddress);
    valid = verification.valid;
    explanation = valid
      ? `10 or more attestations found on Receipts.xyz for ${accountAddress}. A special product is recommended.`
      : `Not more than 10 attestations found on Receipts.xyz for ${accountAddress}. A random product is recommended.`;
  } else if (
    frame?.matchingCriteria === 'COINBASE_ONCHAIN_VERIFICATIONS_COUNTRY'
  ) {
    const verification =
      await verifyCoinbaseOnchainVerificationCountryResidenceAttestation(
        accountAddress,
      );
    valid = verification.valid;
    data = verification.data;
    explanation = valid
      ? `Country of residence verified for ${accountAddress} on Coinbase Onchain. A product based on the country is recommended.`
      : `Country of residence not verified for ${accountAddress} on Coinbase Onchain. A random product is recommended.`;
  } else if (
    frame?.matchingCriteria === 'COINBASE_ONCHAIN_VERIFICATIONS_ACCOUNT'
  ) {
    const verification =
      await verifyCoinbaseOnchainVerificationAccountAttestation(accountAddress);
    valid = verification.valid;
    explanation = valid
      ? `Coinbase account member attestation for ${accountAddress}. A special product is recommended.`
      : `No Coinbase account member attestation for ${accountAddress}. A random product is recommended.`;
  } else if (frame?.matchingCriteria === 'COINBASE_ONCHAIN_VERIFICATIONS_ONE') {
    const verification =
      await verifyCoinbaseOnchainVerificationOneAttestation(accountAddress);
    valid = verification.valid;
    explanation = valid
      ? `Coinbase One account member attestation for ${accountAddress}. A special product is recommended.`
      : `No Coinbase One account member attestation for ${accountAddress}. A random product is recommended.`;
  } else {
    valid = false;
  }

  // Get products
  const products = await db
    .select()
    .from(productSchema)
    .where(eq(productSchema.shop, frame!.shop));

  // Recommend product/s based on onchain data
  let recommendedProduct;
  let imageSrc;
  if (valid) {
    if (frame?.matchingCriteria === 'RECEIPTS_XYZ_ALL_TIME_RUNNING') {
      recommendedProduct = products.find((product) =>
        /Run|Running|Jog/i.test(product.description),
      );

      if (recommendedProduct) {
        imageSrc = `${getBaseUrl()}/api/og?title=Congrats on your +10th run!&subtitle=You're now eligible to buy:&content=${recommendedProduct!.title}&url=${recommendedProduct!.image}&width=600`;
      }
    } else if (
      frame?.matchingCriteria === 'COINBASE_ONCHAIN_VERIFICATIONS_COUNTRY'
    ) {
      const { attestation } = data;

      const schema = 'string verifiedCountry';
      const schemaEncoder = new SchemaEncoder(schema);

      const decodedData = schemaEncoder.decodeData(attestation.data);

      const country = decodedData[0]?.value.value;

      if (country) {
        recommendedProduct = products.find((product) =>
          new RegExp(country as string, 'i').test(product.description),
        );

        if (recommendedProduct) {
          imageSrc = `${getBaseUrl()}/api/og?title=${recommendedProduct!.title}&subtitle=${recommendedProduct!.description}&content=${recommendedProduct!.variantFormattedPrice}&url=${recommendedProduct!.image}&width=600`;

          explanation = `Country of residence verified as ${country} for ${accountAddress} on Coinbase Onchain`;
        } else {
          explanation = `Product not found for country of residence verified as ${country} for ${accountAddress} on Coinbase Onchain`;
        }
      }
    } else if (
      frame?.matchingCriteria === 'COINBASE_ONCHAIN_VERIFICATIONS_ACCOUNT'
    ) {
      recommendedProduct = products.find((product) =>
        /Special/i.test(product.description),
      );

      if (recommendedProduct) {
        imageSrc = `${getBaseUrl()}/api/og?title=${recommendedProduct!.title}&subtitle=${recommendedProduct!.description}&content=${recommendedProduct!.variantFormattedPrice}&url=${recommendedProduct!.image}&width=600`;
      }
    } else if (
      frame?.matchingCriteria === 'COINBASE_ONCHAIN_VERIFICATIONS_ONE'
    ) {
      recommendedProduct = products.find((product) =>
        /Special/i.test(product.description),
      );

      if (recommendedProduct) {
        imageSrc = `${getBaseUrl()}/api/og?title=${recommendedProduct!.title}&subtitle=${recommendedProduct!.description}&content=${recommendedProduct!.variantFormattedPrice}&url=${recommendedProduct!.image}&width=600`;
      }
    }
  }

  if (!recommendedProduct) {
    const randomIndex = Math.floor(Math.random() * products.length);
    recommendedProduct = products[randomIndex];
    imageSrc = `${getBaseUrl()}/api/og?title=${recommendedProduct!.title}&subtitle=${recommendedProduct!.description}&content=${recommendedProduct!.variantFormattedPrice}&url=${recommendedProduct!.image}&width=600`;
    explanation = `No onchain data or matching product found for ${accountAddress}. A random product is recommended.`;
  }

  const buttons: [FrameButtonMetadata, ...FrameButtonMetadata[]] = [
    {
      action: 'link',
      label: 'View',
      target: `https://${frame!.shop}/products/${recommendedProduct!.handle}`,
    },
  ];

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

  const response = getFrameHtmlResponse({
    buttons,
    image: {
      src: imageSrc!,
    },
    ogDescription: recommendedProduct!.title,
    ogTitle: 'Target Onchain',
    postUrl: `${getBaseUrl()}/api/frame`,
    ...(dev && {
      state: {
        description: explanation,
      },
    }),
  });

  return new NextResponse(response);
};
