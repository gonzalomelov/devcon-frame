import type {
  FrameRequest,
  FrameTransactionResponse,
} from '@coinbase/onchainkit/frame';
import { getFrameMessage } from '@coinbase/onchainkit/frame';
import { NextResponse } from 'next/server';
import {
  type Abi,
  // createPublicClient,
  // createWalletClient,
  encodeFunctionData,
  // http,
  parseGwei,
} from 'viem';

// import { privateKeyToAccount } from 'viem/accounts';
// import { arbitrum } from 'viem/chains';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import {
  auctionRaffleABI,
  auctionRaffleAddress,
  defaultErrorFrame,
  // isValidDecimal,
} from '@/utils/Helpers';

export const POST = async (req: Request) => {
  const body: FrameRequest = await req.json();

  const { isValid /* , message */ } = await getFrameMessage(body, {
    neynarApiKey: Env.NEYNAR_API_KEY,
  });

  if (!isValid) {
    logger.info('Message not valid');
    return new NextResponse(defaultErrorFrame);
  }

  // Example usage:
  // const bidAmount = message?.input ?? '0.01';

  // if (!isValidDecimal(bidAmount)) {
  //   logger.info('Invalid bid amount');
  //   return new NextResponse(defaultErrorFrame);
  // }

  // const account = privateKeyToAccount(`0x${Env.GONZALO}`);

  // const publicClient = createPublicClient({
  //   chain: arbitrum,
  //   transport: http(),
  // });

  // const walletClient = createWalletClient({
  //   account,
  //   chain: arbitrum,
  //   transport: http(),
  // });

  // try {
  //   const gasEstimate = await publicClient.estimateGas({
  //     account,
  //     to: '0x10B3F9b8061CaC43BF9Ed26ffE36bAd229807829',
  //     value: BigInt(0.03 * 10 ** 18),
  //     data: encodeFunctionData({
  //       abi: auctionRaffleABI,
  //       functionName: 'bump',
  //     }),
  //   });

  //   console.log('gasEstimate', gasEstimate);

  //   const { request: bump } = await publicClient.simulateContract({
  //     address: '0x10B3F9b8061CaC43BF9Ed26ffE36bAd229807829',
  //     abi: auctionRaffleABI,
  //     functionName: 'bump',
  //     account,
  //     value: BigInt(0.03 * 10 ** 18),
  //   });
  //   console.log('bump', bump);

  //   const bumpTransaction = await walletClient.writeContract(bump);
  //   console.log(bumpTransaction);

  //   const bumpReceipt = await publicClient.waitForTransactionReceipt({
  //     hash: bumpTransaction,
  //   });
  //   console.log('Status:', bumpReceipt);
  // } catch (error) {
  //   console.log('error', error);
  // }

  const data = encodeFunctionData({
    abi: auctionRaffleABI,
    functionName: 'bump',
  });

  const txData: FrameTransactionResponse = {
    chainId: 'eip155:42161', // eip155:42161 for Arbitrum
    method: 'eth_sendTransaction',
    params: {
      abi: auctionRaffleABI as Abi,
      data,
      to: auctionRaffleAddress,
      value: parseGwei('3000000.01').toString(),
    },
  };

  // Return the transaction frame
  return NextResponse.json(txData);
};
