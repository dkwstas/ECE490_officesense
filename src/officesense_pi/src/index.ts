import express from "express";
import lookupRouter from "./api/lookup/lookup.routes.js";
import livedataRouter from "./api/livedata/livadata.routes.js";
import mapperRouter from "./api/mapper/mapper.routes.js";
import { createAdmin, sessionMiddleware } from "./api/management/adminjs.routes.js";
import config from "./config/config.js";
import { bootstrap } from "./core/bootstrap.js";

(async () => {
    const app = express();

    const { admin, router: adminRouter } = await createAdmin();

    app.use(sessionMiddleware);

    app.use("/lookup", lookupRouter);
    app.use("/livedata", livedataRouter);
    app.use("/admin", mapperRouter);
    app.use("/admin", adminRouter);

    app.listen(config.api.port, config.api.address, () => {
        console.log(`Server listening on ${config.api.address}:${config.api.port}`);
    });

    bootstrap();
})();
