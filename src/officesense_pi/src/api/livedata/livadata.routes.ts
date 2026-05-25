import express from "express";
import { getEntities, getEntitiesOfType, getEntity } from "./livedata.controller.js";

const router = express.Router();

router.get("/entities", getEntities);
router.get("/entities", getEntitiesOfType);
router.get("/entities/:urn", getEntity);

export default router;
