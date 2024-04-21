import "dotenv/config.js";

import next from "next";
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { unTypeSafeRouter } from "./routers/index.js";
import { Server } from "@scinorandex/rpscin";
import { createServer } from "http";
import { userRouter } from "./routers/userRouter.js";
import { JwtAuth, setCSRFToken } from "./utils/auth.js";
import { generateGoogleAuth } from "./utils/lib/generateGoogleAuth.js";
import { User } from "@prisma/client";
import { db } from "./utils/prisma.js";
import { ENABLE_GOOGLE_AUTH, ServerConstants } from "./utils/ServerConstants.js";
import session from "express-session";
import { ClientConstants } from "./utils/ClientConstants.js";
import { hookScinDN, projectRouter } from "./routers/projectRouter.js";

const nextApp = next({ dev: ServerConstants.NODE_ENV === "development" });
const handle = nextApp.getRequestHandler();

const staticFolderPath =
  ServerConstants.STATIC_FOLDER_PATH ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/");

const appRouter = unTypeSafeRouter.mergeRouter(userRouter).mergeRouter(projectRouter);
export type AppRouter = typeof appRouter;

const main = async () => {
  await nextApp.prepare();

  const server = express();
  const erpcServer = Server(
    {
      port: 0,
      startAuto: false,
      logErrors: ServerConstants.NODE_ENV === "development",
      apiPrefix: "/api",
    },
    appRouter
  );

  server.disable("etag");
  server.disable("x-powered-by");

  server.use(cookieParser());
  hookScinDN(server);

  if (ENABLE_GOOGLE_AUTH) {
    console.log("Enabling Google Auth");
    const { passport, authenticate } = generateGoogleAuth<{ user_uuid: string }, User>({
      clientID: ServerConstants.GOOGLE_OAUTH2_ID!,
      clientSecret: ServerConstants.GOOGLE_OAUTH2_SECRET!,
      domain: ClientConstants.DOMAIN,

      async getSessionDataFromEmail(gmail) {
        const user = await db.user.findFirst({ where: { username: gmail } });
        if (user) return { user_uuid: user.uuid };
        else throw new Error("Was not able to find a user with that email address");
      },

      async getUserFromSession({ user_uuid }) {
        return await db.user.findFirst({ where: { uuid: user_uuid } });
      },
    });

    server.use(session({ secret: ServerConstants.JWT_SECRET, resave: false, saveUninitialized: false }));
    server.use(passport.authenticate("session"));

    server.get("/login/google", passport.authenticate("google"));
    server.get(
      "/oauth2/redirect/google",
      setCSRFToken,
      passport.authenticate("google", { successRedirect: "/", failureRedirect: "/login" })
    );

    server.use(async (req, res, next) => {
      res.locals.user = await authenticate(req, res).catch(() => null);
      next();
    });
  }

  server.use(async (req, res, next) => {
    if (res.locals.user == undefined) {
      const user = await JwtAuth.authenticate(req).catch(() => null);
      res.locals.user = user;
    }

    next();
  });

  server.use("/api", erpcServer.intermediate);
  server.get("/static/*", express.static(staticFolderPath, { etag: false, immutable: true }));
  server.get("*", (req, res) => handle(req, res));

  server.use((req, res) => nextApp.render404(req, res));
  server.use("*", (err: Error, req: Request, res: Response) => {
    nextApp.renderError(err, req, res, req.path, {});
  });

  const httpServer = createServer(server);
  httpServer.on("upgrade", (req, socket, head) => {
    return erpcServer.createWebSocketHandler()(req, socket, head);
  });

  httpServer.listen(8000, () => {
    console.log("Started on http://localhost:8000 and ws://localhost:8000");
  });
};

main().catch((err) => console.log("unexpected error occured", err));
