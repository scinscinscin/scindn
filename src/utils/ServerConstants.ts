import { z } from "zod";

const ServerConstantsValidator = z.object({
  NODE_ENV: z.enum(["production", "development"]),
  GOOGLE_OAUTH2_ID: z.string().optional(),
  GOOGLE_OAUTH2_SECRET: z.string().optional(),
  JWT_SECRET: z.string(),
  STATIC_FOLDER_PATH: z.string().optional(),
});

export const ServerConstants = ServerConstantsValidator.parse({
  NODE_ENV: process.env.NODE_ENV,
  GOOGLE_OAUTH2_ID: process.env.GOOGLE_OAUTH2_ID,
  GOOGLE_OAUTH2_SECRET: process.env.GOOGLE_OAUTH2_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
});

export const ENABLE_GOOGLE_AUTH = ServerConstants.GOOGLE_OAUTH2_ID && ServerConstants.GOOGLE_OAUTH2_SECRET;
