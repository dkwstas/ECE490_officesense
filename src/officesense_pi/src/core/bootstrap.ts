import { getRoomIDs } from "../api/livedata/livedata.repository.js";
import { initRedis, initSubRedis } from "../redis/redis.js";
import * as mqtt from "./mqtt.js";
import { cleanupWorker } from "./transition.js";

export async function bootstrap() {
    try {
        const redis = await initRedis();

        await redis.flushDb();
        console.log(`[!] Flushed Redis.`);

        const rooms = await getRoomIDs();
        for (const { id } of rooms)
            await redis.set(`room:${id}`, 0);

        await initSubRedis();
        await mqtt.start();

        cleanupWorker();

        console.log("[!] Core started.");
    } catch (err: any) {
        console.log("[!] Bootstrap failed:", err.message);
        process.exit(1);
    }
}