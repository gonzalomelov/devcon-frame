import type {
  FrameButtonMetadata,
  FrameRequest,
} from '@coinbase/onchainkit/frame';
import {
  getFrameHtmlResponse,
  getFrameMessage,
} from '@coinbase/onchainkit/frame';
import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { frameSchema, productSchema, userProductSchema } from '@/models/Schema';
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

export type AttestationsQueryResponse = {
  data?: {
    attestations: Attestation[];
  };
};

export type Poap = {
  eventId: string;
  tokenId: string;
  poapEvent: {
    eventName: string;
    description: string;
  };
};

interface Data {
  Poaps: { Poap: Poap[] };
}

interface PoapsQueryResponse {
  data: Data;
}

export type Product = {
  id: string;
  title: string;
  description: string;
};

function extractKeywords(text: string): string[] {
  return text.match(/\b(\w+)\b/g)?.map((word) => word.toLowerCase()) || [];
}

function countMatchedKeywords(poap: Poap, product: Product): number {
  const poapKeywords = extractKeywords(`${poap.poapEvent.eventName}`);
  const productKeywords = new Set(extractKeywords(`${product.title}`));

  // Count matches by checking each POAP keyword against product keywords
  return poapKeywords.filter((keyword) => productKeywords.has(keyword)).length;
}

function recommendProducts(poap: Poap, products: Product[]): Product[] {
  return products
    .map((product) => ({
      product,
      matchCount: countMatchedKeywords(poap, product),
    }))
    .filter((item) => item.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .map((item) => item.product);
}

const validAttestations = async (
  address: string,
  schema?: string,
  attester?: string,
): Promise<Attestation[]> => {
  // Build the filter conditions based on provided inputs
  let filters = `recipient: { equals: "${address}", mode: insensitive }`;
  if (schema) {
    filters += `, schemaId: { equals: "${schema}", mode: insensitive }`;
  }
  if (attester) {
    filters += `, attester: { equals: "${attester}", mode: insensitive }`;
  }

  const query = `
    query Attestations {
      attestations(
        where: { ${filters} }
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

  const result: AttestationsQueryResponse = await response.json();

  const attestations = result.data!.attestations || [];

  const filteredAttestations = attestations.filter(
    (attestation: Attestation) =>
      attestation.revocationTime === 0 &&
      attestation.expirationTime === 0 &&
      (!schema || attestation.schema.id === schema),
  );

  return filteredAttestations;
};

const validPoaps = async (address: string): Promise<Poap[]> => {
  const query = `
    query MyQuery {
      Poaps(input: {filter: {owner: {_in: ["${address}"]}}, blockchain: ALL}) {
        Poap {
          eventId
          tokenId
          poapEvent {
            eventName
            description
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.airstack.xyz/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: Env.AIRSTACK_API_KEY,
    },
    body: JSON.stringify({ query }),
  });

  const result: PoapsQueryResponse = await response.json();

  const poaps = result.data!.Poaps.Poap || [];

  return poaps;
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

const verifyPoapsOwned = async (
  address: string,
): Promise<{ valid: boolean; data: any }> => {
  const poaps = await validPoaps(address);
  return {
    valid: poaps.length > 0,
    data: { poaps },
  };
};

const verifyAll = async (
  address: string,
  frameId: number,
): Promise<{ valid: boolean; data: any }> => {
  const recommendedProducts = await db
    .select()
    .from(userProductSchema)
    .where(
      and(
        eq(userProductSchema.walletAddress, address),
        eq(userProductSchema.frameId, frameId),
      ),
    );

  return {
    valid: recommendedProducts.length > 0,
    data: { recommendedProducts },
  };
};

// Take into account old attestations

type VerificationFunction = (
  address: string,
  frameId?: number,
) => Promise<{ valid: boolean; data?: any }>;
type MessageFunction = (address: string) => string;

interface VerificationMapEntry {
  verify: VerificationFunction;
  success: MessageFunction;
  failure: MessageFunction;
}

const verificationMap: { [key: string]: VerificationMapEntry } = {
  RECEIPTS_XYZ_ALL_TIME_RUNNING: {
    verify: verifyReceiptsRunningAttestation,
    success: (address: string) =>
      `10 or more attestations found on Receipts.xyz for ${address}. A special product is recommended.`,
    failure: (address: string) =>
      `Not more than 10 attestations found on Receipts.xyz for ${address}. A random product is recommended.`,
  },
  COINBASE_ONCHAIN_VERIFICATIONS_COUNTRY: {
    verify: verifyCoinbaseOnchainVerificationCountryResidenceAttestation,
    success: (address: string) =>
      `Country of residence verified for ${address} on Coinbase Onchain. A product based on the country is recommended.`,
    failure: (address: string) =>
      `Country of residence not verified for ${address} on Coinbase Onchain. A random product is recommended.`,
  },
  COINBASE_ONCHAIN_VERIFICATIONS_ACCOUNT: {
    verify: verifyCoinbaseOnchainVerificationAccountAttestation,
    success: (address: string) =>
      `Coinbase account member attestation for ${address}. A special product is recommended.`,
    failure: (address: string) =>
      `No Coinbase account member attestation for ${address}. A random product is recommended.`,
  },
  COINBASE_ONCHAIN_VERIFICATIONS_ONE: {
    verify: verifyCoinbaseOnchainVerificationOneAttestation,
    success: (address: string) =>
      `Coinbase One account member attestation for ${address}. A special product is recommended.`,
    failure: (address: string) =>
      `No Coinbase One account member attestation for ${address}. A random product is recommended.`,
  },
  POAPS_OWNED: {
    verify: verifyPoapsOwned,
    success: (address: string) =>
      `POAPs owned by ${address}. A specific product might be recommended.`,
    failure: (address: string) =>
      `No POAPs owned by ${address}. A random product is recommended.`,
  },
  ALL: {
    verify: (address: string, frameId?: number) => verifyAll(address, frameId!),
    success: (address: string) =>
      `Related onchain data found for ${address}. A specific product might be recommended.`,
    failure: (address: string) =>
      `No related onchain data found for ${address}. A specific product might be recommended.`,
  },
};

const processVerification = async (
  matchingCriteria: string | undefined,
  accountAddress: string,
  frameId: number,
) => {
  if (!matchingCriteria || !verificationMap[matchingCriteria]) {
    return { valid: false, explanation: '', data: null };
  }

  const { verify, success, failure } = verificationMap[matchingCriteria]!;
  const verification = await verify(accountAddress, frameId);
  const { valid } = verification;
  const explanation = valid ? success(accountAddress) : failure(accountAddress);

  return { valid, explanation, data: verification.data };
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
  const { valid, explanation, data } = await processVerification(
    frame?.matchingCriteria!,
    accountAddress,
    frame?.id!,
  );

  let customExplanation = explanation;

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

          customExplanation = `Country of residence verified as ${country} for ${accountAddress} on Coinbase Onchain`;
        } else {
          customExplanation = `Product not found for country of residence verified as ${country} for ${accountAddress} on Coinbase Onchain`;
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
    } else if (frame?.matchingCriteria === 'POAPS_OWNED') {
      const { poaps } = data;

      const recommendedProducts: Product[] = [];
      const recommendedProductIds = new Set<string>();

      poaps.forEach((poap: Poap) => {
        const recommendations = recommendProducts(poap, products);
        recommendations.forEach((product) => {
          if (!recommendedProductIds.has(product.id)) {
            recommendedProducts.push(product);
            recommendedProductIds.add(product.id);
          }
        });
      });

      if (recommendedProducts.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * recommendedProducts.length,
        );
        recommendedProduct = products.find(
          (p) => p.title === recommendedProducts[randomIndex]!.title,
        );

        imageSrc = `${getBaseUrl()}/api/og?title=${recommendedProduct!.title}&subtitle=${recommendedProduct!.description}&content=${recommendedProduct!.variantFormattedPrice}&url=${recommendedProduct!.image}&width=600`;

        customExplanation = `Product found from visited country on Poap ${recommendedProducts[randomIndex]!.title} for ${accountAddress} based on Poaps`;
      } else {
        customExplanation = `No product matched for countries visited for ${accountAddress} based on Poaps`;
      }
    } else if (frame?.matchingCriteria === 'ALL') {
      const { recommendedProducts } = data;

      if (recommendedProducts.length > 0) {
        recommendedProduct = products.find(
          (p) => p.id === recommendedProducts[0]!.productId1,
        );

        if (recommendedProduct) {
          imageSrc = `${getBaseUrl()}/api/og?title=${recommendedProduct!.title}&subtitle=${recommendedProduct!.description}&content=${recommendedProduct!.variantFormattedPrice}&url=${recommendedProduct!.image}&width=600`;
        }
      }
    }
  }

  if (!recommendedProduct) {
    const randomIndex = Math.floor(Math.random() * products.length);
    recommendedProduct = products[randomIndex];
    imageSrc = `${getBaseUrl()}/api/og?title=${recommendedProduct!.title}&subtitle=${recommendedProduct!.description}&content=${recommendedProduct!.variantFormattedPrice}&url=${recommendedProduct!.image}&width=600`;
    customExplanation = `No onchain data or matching product found for ${accountAddress}. A random product is recommended.`;
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
        description: customExplanation,
      },
    }),
  });

  return new NextResponse(response);
};
