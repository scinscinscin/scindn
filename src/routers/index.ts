import { Connection, wsValidate } from "@scinorandex/erpc";
import { createWebSocketEndpoint, getRootRouter } from "@scinorandex/rpscin";
import { baseProcedure } from "../utils/auth.js";

export const unTypeSafeRouter = getRootRouter({
  "/status": {
    get: baseProcedure.use(async () => {
      return {
        status: "ok",
        time: Date.now(),
        timePH: new Date().toLocaleString("en-PH"),
      };
    }),
  },
});
