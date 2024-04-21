import { ERPCError, baseProcedure } from "@scinorandex/erpc";
import { authProcedure } from "../utils/auth.js";
import { generateSaltFunction } from "../utils/lib/generateSaltFunction.js";
import { db } from "../utils/prisma.js";
import { unTypeSafeRouter } from "./index.js";
import { z } from "zod";
import Express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import formidable, { File } from "formidable";
import { FileMimeType } from "../utils/mime.js";
import path from "path";
import { mkdir, rename, rm } from "fs/promises";
import { Project } from "@prisma/client";
import crypto from "crypto";

const generateRandom = generateSaltFunction({ type: "url-safe", length: 128 });
const generateFilename = generateSaltFunction({ type: "alphanumeric", length: 40 });

export const signedUrls = new Map<string, string>();
const projectCache = new Map<string, Project & { parsedOrigins: string[] }>();

const staticFolderPath = path.join(process.cwd(), "./public/static");

(async () => {
  const projects = await db.project.findMany();
  for (const proj of projects)
    projectCache.set(proj.secret, {
      ...proj,
      parsedOrigins: JSON.parse(proj.jsOrigins),
    });
})();

export const projectRouter = unTypeSafeRouter.sub("/project", {
  "/create": {
    post: authProcedure
      .input(z.object({ name: z.string(), origins: z.array(z.string()) }))
      .use(async (req, res, { input, user }) => {
        for (const origin of input.origins) {
          try {
            new URL(origin).origin;
          } catch {
            throw new ERPCError({ code: "BAD_REQUEST", message: "Atleast one of the origins was malformed" });
          }
        }

        const secret = await generateRandom();
        const clientId = "scindn_" + (await generateRandom());

        const newProject = await db.project.create({
          data: {
            clientId,
            secret,
            name: input.name,
            jsOrigins: JSON.stringify(input.origins),
            ownerUuid: user.uuid,
          },
        });

        console.log("Created a new project:", newProject);
        const clientFolderPath = path.join(staticFolderPath, `./${newProject.uuid}`);
        await mkdir(clientFolderPath);

        projectCache.set(secret, {
          ...newProject,
          parsedOrigins: JSON.parse(newProject.jsOrigins),
        });
        return { clientId, secret, name: input.name };
      }),
  },

  "/generateLink": {
    post: baseProcedure
      .input(z.object({ secret: z.string(), timeoutSeconds: z.number().max(3600).optional() }))
      .use(async (req, res, { input }) => {
        const project = await db.project.findFirst({ where: { secret: input.secret } });
        if (!project) throw new ERPCError({ code: "BAD_REQUEST", message: "No project found with that secret" });

        const hash = await generateRandom();
        signedUrls.set(hash, project.secret);

        if (input.timeoutSeconds) {
          setTimeout(() => {
            signedUrls.delete(hash);
          }, input.timeoutSeconds);
        }

        const link = `/upload/${hash}`;
        return { link };
      }),
  },

  "/delete": {
    post: baseProcedure
      .input(z.object({ filename: z.string(), secret: z.string() }))
      .use(async (req, res, { input }) => {
        const project = await db.project.findFirst({ where: { secret: input.secret } });
        if (!project) throw new ERPCError({ code: "NOT_FOUND", message: "No project found with ID" });
        const filename = input.filename.replaceAll("/", "");
        const absolutePath = path.join(staticFolderPath, `/${project.uuid}/${filename}`);

        if (!absolutePath.startsWith(staticFolderPath))
          throw new ERPCError({ code: "SERVER_ERROR", message: "Internal server error" });

        console.log("deleting", absolutePath);
        rm(absolutePath);
        return { success: true };
      }),
  },
});

type Handler<T> = (req: Request, res: Response, next: NextFunction) => T;
const handleAsync = (handler: Handler<Promise<void>>): Handler<void> => {
  return (req, res, next) => {
    handler(req, res, next).catch((err) => {
      console.log("error in handler", err);
      const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Internal Server Error";
      res.status(500).send(msg);
    });
  };
};

export const hookScinDN = (app: Express.Express) => {
  app.use(
    "/upload/:hash",
    handleAsync(async (req, res, next) => {
      const projectSecret = signedUrls.get(req.params.hash);
      if (projectSecret == undefined) throw "Invalid upload link";

      const project = projectCache.get(projectSecret)!;
      if (!project) throw "No project associated with secret";

      res.locals.project = project;
      return cors({ credentials: true, origin: project.parsedOrigins })(req, res, next);
    })
  );

  app.put(
    "/upload/:hash",
    multipartFormParser,
    handleAsync(async (req, res, next) => {
      signedUrls.delete(req.params.hash);
      const project = res.locals.project as Project;
      const parsedFiles = [] as { bytes: number; originalFilename: string; link: string }[];

      const files = req.body as File[];
      for (const file of files) {
        if (!file.mimetype) continue;
        const extension = FileMimeType[file.mimetype];

        if (!extension) continue;

        const slug = await generateFilename();
        const filename = `${slug}.${extension}`;

        const bucketPath = `/${project.uuid}/${filename}`;
        const absolutePath = path.join(staticFolderPath, bucketPath);

        rename(file.filepath, absolutePath);
        parsedFiles.push({
          bytes: file.size,
          link: bucketPath,
          originalFilename: file.originalFilename as string,
        });
      }

      const payload = JSON.stringify({ signedAt: Date.now(), files: parsedFiles });
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-128-cbc",
        crypto.scryptSync(project.secret, "open-internet-gamers", 16),
        iv
      );

      const encrypted = cipher.update(payload, "utf8", "hex") + cipher.final("hex");
      res.send(`${encrypted}|${iv.toString("hex")}`);
    })
  );
};

const multipartFormParser = handleAsync(async (req, res, next) => {
  const form = formidable({ multiples: true });

  try {
    const result = await new Promise<{ [x: string]: string | string[] | formidable.File | formidable.File[] }>(
      (resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve({ ...fields, ...files });
        });
      }
    );

    if (result.files == undefined) throw new Error(`No field "files" found in body`);
    else if (Array.isArray(result.files) == false) throw new Error("Files found but it's not an array");

    const files = (result.files as (string | File)[]).filter((x) => typeof (x as any).filepath === "string");
    req.body = files;
    next();
  } catch {
    throw new Error("Failed to parse multipart/form-data body");
  }
});
