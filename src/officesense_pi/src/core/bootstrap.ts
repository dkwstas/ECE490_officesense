import { initRedis } from "./redis.js";
import * as mqtt from "./mqtt.js";
import { cleanupWorker } from "./transition.js";

export async function bootstrap() {
    try {
        await initRedis();
        await mqtt.start();
        cleanupWorker();

        console.log("Core started.");
    } catch (err: any) {
        console.log("Bootstrap failed:", err.message);
        process.exit(1);
    }
}