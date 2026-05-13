import { prisma } from "../../lib/prisma.js";

export async function existsByUUID(uuid: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: uuid }
    });

    return !!user;
}
