import express from "express";
import { check } from "./lookup.controller.js";

const router = express.Router();

router.get("/check/:uuid", check);

export default router;
