import { z } from "zod";

const ClientConstantsValidator = z.object({
  HTTP_API_LINK: z.string().optional().default("/api"),
  HTTP_WS_LINK: z.string().optional().default("ws://localhost:8000/api"),
  DOMAIN: z.string().optional(),
});

export const ClientConstants = ClientConstantsValidator.parse({
  HTTP_API_LINK: process.env.NEXT_PUBLIC_HTTP_API_LINK,
  HTTP_WS_LINK: process.env.NEXT_PUBLIC_HTTP_WS_LINK,
  DOMAIN: process.env.NEXT_PUBLIC_DOMAIN,
});
