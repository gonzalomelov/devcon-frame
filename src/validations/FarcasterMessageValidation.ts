import { z } from 'zod';

export const FarcasterMessageValidation = z.object({
  untrustedData: z.object({
    fid: z.number(),
    url: z.string().url(),
    messageHash: z.string().min(1),
    timestamp: z.number(),
    network: z.number(),
    buttonIndex: z.number(),
    castId: z.object({
      fid: z.number(),
      hash: z.string().min(1),
    }),
  }),
  trustedData: z.object({
    messageBytes: z.string().min(1),
  }),
});
