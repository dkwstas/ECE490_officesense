import express from "express";
import { getRedisMapping, checkSession } from "./mapper.controller.js";

const router = express.Router();

router.get("/map", checkSession, getRedisMapping);

export default router;
