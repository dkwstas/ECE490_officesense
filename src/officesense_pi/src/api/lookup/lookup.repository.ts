import { prisma } from "../../lib/prisma.js";

export async function existsByUUID(uuid: string): Promise<boolean> {
    const tag = await prisma.tag.findUnique({
        where: { id: uuid },
    });

    return !!tag;
}
