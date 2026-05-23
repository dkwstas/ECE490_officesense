import express from "express";
import lookupRoutes from "./api/lookup/lookup.routes.js";
import config from "./config/config.js";
import { bootstrap } from "./core/bootstrap.js";

(async () => {
    const app = express();

    app.use("/", lookupRoutes);

    app.listen(config.api.port, config.api.address, () => {
        console.log(`Server listening on ${config.api.address}:${config.api.port}`);
    });

    bootstrap();

})()
