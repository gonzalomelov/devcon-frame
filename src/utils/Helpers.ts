import { getFrameHtmlResponse } from '@coinbase/onchainkit/frame';
import { ethers } from 'ethers';
import { JsonRpcProvider } from 'ethers/providers';

import { AppConfig } from './AppConfig';

export const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
};

export const getI18nPath = (url: string, locale: string) => {
  if (locale === AppConfig.defaultLocale) {
    return url;
  }

  return `/${locale}${url}`;
};

export const defaultErrorFrame = getFrameHtmlResponse({
  buttons: [
    {
      action: 'link',
      label: 'Learn more',
      target: 'https://raffle.devcon.org',
    },
  ],
  image: {
    src: `${getBaseUrl()}/api/og?title=Devcon 7&subtitle=&content=&url=https://i.imgur.com/k7EkTmI.png`,
  },
  ogDescription: 'Devcon 7',
  ogTitle: 'Devcon 7',
});

// Replace with your contract ABI and address
export const auctionRaffleABI = [
  {
    inputs: [],
    name: 'bump',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBidsWithAddresses',
    outputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'bidder',
            type: 'address',
          },
          {
            components: [
              { internalType: 'uint256', name: 'bidderID', type: 'uint256' },
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
              { internalType: 'bool', name: 'isAuctionWinner', type: 'bool' },
              { internalType: 'bool', name: 'claimed', type: 'bool' },
              {
                internalType: 'uint240',
                name: 'raffleParticipantIndex',
                type: 'uint240',
              },
            ],
            internalType: 'struct BidModel.Bid',
            name: 'bid',
            type: 'tuple',
          },
        ],
        internalType: 'struct BidModel.BidWithAddress[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export const auctionRaffleAddress =
  '0x1E7aC276CBdae55689Df1d99108d69Fff444cB88';

const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc');

// export const getBumpEncodedData = async (
//   bidAmount: string,
// ): Promise<string> => {
//   // Create a contract instance
//   const contract = new ethers.Contract(
//     auctionRaffleAddress,
//     auctionRaffleABI,
//     provider,
//   );

//   // Prepare the transaction data
//   const tx = await contract.bump.populateTransaction({
//     value: ethers.parseEther(bidAmount),
//   });

//   // Return the encoded transaction data
//   return tx.data!;
// };

export const getBidsWithAddresses = async (): Promise<any> => {
  // Create a contract instance
  const contract = new ethers.Contract(
    auctionRaffleAddress,
    auctionRaffleABI,
    provider,
  );

  // Call the getBidsWithAddresses method
  const bids = await contract.getBidsWithAddresses!();

  return bids;
};

export const hasBidsFromAddress = async (address: string): Promise<boolean> => {
  // Call the getBidsWithAddresses method
  const bids = await getBidsWithAddresses();

  // Check if any bid is from the specified address
  const hasBid = bids.some(
    (bid: any) => bid.bidder.toLowerCase() === address.toLowerCase(),
  );

  return hasBid;
};

export const isValidDecimal = (input: string): boolean => {
  const number = Number(input);
  return !Number.isNaN(number) && Number.isFinite(number);
};
