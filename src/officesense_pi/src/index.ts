import express from "express";
import lookupRoutes from "./api/lookup/lookup.routes.js";

const app = express();
const PORT = 80;
const ADDRESS = "0.0.0.0";

app.use("/", lookupRoutes);

app.listen(PORT, ADDRESS, () => {
    console.log(`Server listening on ${ADDRESS}:${PORT}`);
});
