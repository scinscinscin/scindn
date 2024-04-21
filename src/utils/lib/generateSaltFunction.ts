import { Options, cryptoRandomStringAsync as crs } from "crypto-random-string";

export const generateSaltFunction = (opts?: Options) => () =>
  crs({ length: opts?.length ?? 128, type: opts?.type ?? "base64" });
