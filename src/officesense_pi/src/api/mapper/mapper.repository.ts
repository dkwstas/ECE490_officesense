import { getRedis } from "../../redis/redis.js";
import { prisma } from "../../lib/prisma.js";

export async function generateMap() {
    const redis = getRedis();

    const keys = await redis.keys("user:*");

    const sessions = await Promise.all(
        keys.map(async (key) => {
            const raw = await redis.get(key);
            const session = JSON.parse(raw!);
            const realUserId = key.replace("user:", "");

            const user = await prisma.user.findUnique({
                where: { id: realUserId },
                select: { id: true, firstName: true, lastName: true },
            });

            return {
                realUserId,
                firstName: user?.firstName ?? "Unknown",
                lastName: user?.lastName ?? "Unknown",
                pseudoId: session.userID,
                pseudoName: session.name,
            };
        })
    );

    return sessions;
}
