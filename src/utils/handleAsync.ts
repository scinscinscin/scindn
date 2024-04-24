import { NextFunction, Request, Response } from "express";

export type Handler<T> = (req: Request, res: Response, next: NextFunction) => T;
export const handleAsync = (handler: Handler<Promise<void>>): Handler<void> => {
  return (req, res, next) => {
    handler(req, res, next).catch((err) => {
      const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Internal Server Error";
      res.status(500).send(msg);
    });
  };
};
