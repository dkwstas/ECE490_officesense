import type { Request, Response } from "express";
import { existsByUUID } from "./lookup.repository.js";

interface Params {
    uuid: string;
}

export async function check(req: Request<Params>, res: Response) {
    const { uuid } = req.params;

    const exists = await existsByUUID(uuid);

    if (!exists) return res.sendStatus(404);

    return res.sendStatus(200);
}
