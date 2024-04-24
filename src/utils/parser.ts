import formidable from "formidable";
import { handleAsync } from "./handleAsync.js";

export const multipartFormParser = handleAsync(async (req, res, next) => {
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
