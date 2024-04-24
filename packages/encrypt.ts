import crypto from "crypto";
import { z } from "zod";

export const decryptedValidator = z.object({
  signedAt: z.number(),
  files: z.array(z.object({ bytes: z.number(), link: z.string(), originalFilename: z.string() })),
});

export const scindnCipher = {
  $encrypt(secret: string, salt: string, payload: any) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-128-cbc", crypto.scryptSync(secret, salt, 16), iv);

    const encrypted = cipher.update(payload, "utf8", "hex") + cipher.final("hex");
    return `${encrypted}|${iv.toString("hex")}`;
  },

  decrypt(secret: string, salt: string, data: string) {
    const [encrypted, ivStr] = data.split("|");

    const cipher = crypto.createDecipheriv(
      "aes-128-cbc",
      crypto.scryptSync(secret, salt, 16),
      Buffer.from(ivStr, "hex")
    );

    const decrypted = cipher.update(encrypted, "hex", "utf8") + cipher.final("utf8");
    try {
      return decryptedValidator.parseAsync(JSON.parse(decrypted));
    } catch {
      throw new Error("Decrypted payload did not match ScinDN response type");
    }
  },
};
