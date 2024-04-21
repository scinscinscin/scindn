import { User } from "@prisma/client";
import { generateHashingFunction } from "./lib/generateHashingFunction.js";
import { generateJWTAuth } from "./lib/generateJWTAuth.js";
import { generateSaltFunction } from "./lib/generateSaltFunction.js";
import { db } from "./prisma.js";
import { ERPCError, baseProcedure as _baseProcedure } from "@scinorandex/erpc";
import { Request, Response } from "express";
import { ServerConstants } from "./ServerConstants.js";
import cryptoRandomString from "crypto-random-string";

export const hashPassword = generateHashingFunction({});
export const createSalt = generateSaltFunction();
export const JwtAuth = generateJWTAuth<{ uuid: string }, User>({
  cookieName: "ssr-template-auth",
  jwtKey: ServerConstants.JWT_SECRET,

  getUserFromPayload: async ({ uuid }) => {
    const user = await db.user.findUnique({ where: { uuid } });
    if (!user) throw new Error("Was not able to find a user with that uuid");
    return user;
  },

  getCookieOptions: () => ({
    maxAge: 1000 * 60 * 60 * 24 * 7,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  }),
});

// Extend the default base procedure to add the user object into the middleware chain
export const baseProcedure = _baseProcedure.extend(async (req, res) => {
  const user = (res.locals as { user: User | null }).user;
  return { user };
});

/**
 * Attach a new CSRF token to a response object
 * @param req Express request object
 * @param res Express response object
 * @param next A callback so this function can be used as express middleware
 */
export const setCSRFToken = async (req: Request, res: Response, next?: () => void) => {
  res.cookie("csrfToken", cryptoRandomString({ length: 36 }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  if (next) next();
};

/**
 * Use this procedure to check if CSRF was double sent
 * The CSRF token *must be set set when the user successfully logs in*
 */
export const csrfProcedure = baseProcedure.extend(async (req, res) => {
  const csrFToken = req.cookies["csrfToken"];
  const csrfHeader = req.headers[`x-csrf-token`];

  const method = req.method.toLowerCase();
  if (method === "get" || method === "delete") {
    // GET and DELETE requests don't have custom headers set on them from Axios
    // so we can only check the tokens
    setCSRFToken(req, res);
    return {};
  }

  if (typeof csrFToken !== "string" || typeof csrfHeader !== "string")
    throw new ERPCError({ code: "UNAUTHORIZED", message: "CSRF token not found" });
  else if (csrFToken !== csrfHeader) throw new ERPCError({ code: "UNAUTHORIZED", message: "CSRF token mismatch" });

  setCSRFToken(req, res);
  return {};
});

/**
 * This procedure checks if the request was made by an logged in user.
 * Throws UNAUTHROIZED if the user is not logged in
 */
export const authProcedure = csrfProcedure.extend(async (req, res) => {
  const user = res.locals.user;

  if (user) return { user };
  else throw new ERPCError({ code: "UNAUTHORIZED", message: "You are not logged in" });
});
