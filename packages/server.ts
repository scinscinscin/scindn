import { Axios } from "axios";
import { scindnCipher } from "./encrypt";

interface Options {
  secret: string;
  scindnDomain: string;
}

export function createScinDNClient(options: Options) {
  const axios = new Axios({
    baseURL: options.scindnDomain,
    transformRequest: (x) => JSON.stringify(x),
    transformResponse: (x) => JSON.parse(x),
    headers: { "Content-Type": "application/json" },
  });

  async function decrypt(data: { encrypted: string; key: string }) {
    const decrypted = await scindnCipher.decrypt(options.secret, data.key, data.encrypted);
    return decrypted;
  }

  async function generateLink(opts: { key: string; timeout?: number }) {
    const payload = { secret: options.secret, key: opts.key, timeout: opts.timeout };

    try {
      const { data } = await axios.post("/api/project/generateLink", payload);
      return data.result.link as string;
    } catch (err) {
      console.error("failed to generate link: ", err);
      throw new Error("Failed to generate presigned link");
    }
  }

  return { generateLink, decrypt };
}
