import type { NextFunction, Request, Response } from "express";
import { generateMap } from "./mapper.repository.js";

export function checkSession(req: Request, res: Response, next: NextFunction) {
    if (!(req.session as any)?.adminUser) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

export async function getRedisMapping(req: Request, res: Response) {
    try {
        res.status(200).send(await generateMap());
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
}
