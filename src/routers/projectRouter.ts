import { ERPCError, baseProcedure } from "@scinorandex/erpc";
import { authProcedure } from "../utils/auth.js";
import { generateSaltFunction } from "../utils/lib/generateSaltFunction.js";
import { db } from "../utils/prisma.js";
import { unTypeSafeRouter } from "./index.js";
import { z } from "zod";
import Express from "express";
import cors from "cors";
import { File } from "formidable";
import { FileMimeType } from "../utils/mime.js";
import path from "path";
import { copyFile, mkdir, rm } from "fs/promises";
import { Project } from "@prisma/client";
import { handleAsync } from "../utils/handleAsync.js";
import { multipartFormParser } from "../utils/parser.js";
import { decryptedValidator, scindnCipher } from "../utils/encrypt.js";

const staticFolderPath = path.join(process.cwd(), "./public/static");
const generateRandom = generateSaltFunction({ type: "alphanumeric", length: 128 });
const generateFilename = generateSaltFunction({ type: "alphanumeric", length: 40 });

/**
 * Maps a signed url to the project it's assigned to and the key to use when sending response
 */
export const signedUrls = new Map<string, { secret: string; key: string }>();

/**
 * Maps a project secret to the project object and the list of allowed js origins
 */
const projectCache = new Map<string, Project & { parsedOrigins: string[] }>();
(async () => {
  const projects = await db.project.findMany();
  for (const proj of projects)
    projectCache.set(proj.secret, {
      ...proj,
      parsedOrigins: JSON.parse(proj.jsOrigins),
    });
})();

const generateLinkValidator = z.object({
  secret: z.string(),
  key: z.string(),
  timeoutSeconds: z.number().max(3600).optional(),
});

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
    post: baseProcedure.input(generateLinkValidator).use(async (req, res, { input }) => {
      const project = await db.project.findFirst({ where: { secret: input.secret } });
      if (!project) throw new ERPCError({ code: "BAD_REQUEST", message: "No project found with that secret" });

      const hash = await generateRandom();
      signedUrls.set(hash, { key: input.key, secret: project.secret });

      if (input.timeoutSeconds) setTimeout(() => signedUrls.delete(hash), input.timeoutSeconds * 1000);
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

        rm(absolutePath);
        return { success: true };
      }),
  },
});

export const hookScinDN = (app: Express.Express) => {
  app.use(
    "/upload/:hash",
    handleAsync(async (req, res, next) => {
      try {
        const { key, secret } = signedUrls.get(req.params.hash)!;
        const project = projectCache.get(secret)!;

        res.locals.project = project;
        res.locals.key = key;

        return cors({ credentials: true, origin: project.parsedOrigins })(req, res, next);
      } catch (err) {
        console.log("Error while processing CORS request:", err);
        throw new Error("Internal server error");
      }
    })
  );

  app.put(
    "/upload/:hash",
    multipartFormParser,
    handleAsync(async (req, res, next) => {
      const { key, project } = res.locals as { project: Project; key: string };
      const files = req.body as File[];

      const parsedFiles = [] as { bytes: number; originalFilename: string; link: string }[];
      for (const file of files) {
        try {
          const result = await processFile(file, project.uuid);
          parsedFiles.push(result);
        } catch (err) {
          console.error("Failed to process file because:", err);
        }
      }

      const payload: z.infer<typeof decryptedValidator> = { signedAt: Date.now(), files: parsedFiles };
      const encrypted = scindnCipher.$encrypt(project.secret, key, JSON.stringify(payload));
      res.send(encrypted);
      signedUrls.delete(req.params.hash);
    })
  );
};

async function processFile(file: File, projectUuid: string) {
  if (!file.mimetype) throw new Error("File does not contain mimetype");
  const extension = FileMimeType[file.mimetype];

  if (!extension) throw new Error("File does not contain mimetype");

  const slug = await generateFilename();
  const filename = `${slug}.${extension}`;

  const bucketPath = `/${projectUuid}/${filename}`;
  const absolutePath = path.join(staticFolderPath, bucketPath);

  await copyFile(file.filepath, absolutePath);
  return { bytes: file.size, link: bucketPath, originalFilename: file.originalFilename as string };
}
