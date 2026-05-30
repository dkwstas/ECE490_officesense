import express from "express";
import { getEntities, getEntitiesOfType, getEntity } from "./livedata.controller.js";

const router = express.Router();

router.get("/entities", getEntities, getEntitiesOfType);
router.get("/entities/:urn", getEntity);

export default router;
