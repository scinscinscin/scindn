import { ERPCError } from "@scinorandex/erpc";
import { z } from "zod";
import { unTypeSafeRouter } from "./index.js";
import { db } from "../utils/prisma.js";
import { JwtAuth, baseProcedure, createSalt, hashPassword, setCSRFToken } from "../utils/auth.js";
import { ServerConstants } from "../utils/ServerConstants.js";

export const userRouter = unTypeSafeRouter.sub("/user", {
  "/login": {
    post: baseProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .use(async (req, res, { input }) => {
        try {
          const user = await db.user.findUnique({ where: { username: input.username } });
          if (!user) throw new Error("failed to find a user with that username");

          const hashedPassword = await hashPassword({ plain: input.password, salt: user.salt });
          if (hashedPassword !== user.hash) throw new Error("Incorrect credentials");

          JwtAuth.signIn(req, res, { uuid: user.uuid });
          setCSRFToken(req, res);
          return { success: true };
        } catch (err) {
          console.error("falled to login because: ", err);
          throw new ERPCError({ code: "BAD_REQUEST", message: "Failed to login" });
        }
      }),
  },

  "/register": {
    post: baseProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .extend(async (req, res) => {
        if (ServerConstants.NODE_ENV === "development") return {};
        throw new ERPCError({ code: "BAD_REQUEST", message: "Account creation has been disabled for production" });
      })
      .use(async (req, res, { input }) => {
        const salt = await createSalt();
        const hash = await hashPassword({ plain: input.password, salt });

        const newUser = await db.user.create({
          data: { hash, salt, username: input.username },
        });

        JwtAuth.signIn(req, res, { uuid: newUser.uuid });
        return { success: true };
      }),
  },
});
