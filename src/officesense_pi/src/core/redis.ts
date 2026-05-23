import { createClient, type RedisClientType } from "redis";
import config from "../config/config.js";

let redisClient: RedisClientType;

export async function initRedis(): Promise<RedisClientType> {
    redisClient = createClient({
        url: `redis://${config.redis.host}:${config.redis.port}`
    });

    redisClient.on("error", (err) => {
        console.log("Redis error:", err.message);
    });

    await redisClient.connect();

    console.log("Redis connected.");

    return redisClient;
}

export function getRedis(): RedisClientType {
    if (!redisClient) {
        throw new Error("Redis not initialized");
    }

    return redisClient;
}