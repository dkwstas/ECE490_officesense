import { createClient, type RedisClientType } from "redis";
import config from "../config/config.js";
import { updateRoomOccupancyListener } from "../core/analyze.js";

let redisClient: RedisClientType;
let subRedisClient: RedisClientType;

export async function initSubRedis(): Promise<void> {
    subRedisClient = createClient({
        url: `redis://${config.redis.host}:${config.redis.port}`
    });

    subRedisClient.on("error", (err) => {
        console.log("[Redis] SubRedis error:", err.message);
    });

    await subRedisClient.connect();

    console.log("[Redis] SubRedis connected.");

    subRedisClient.pSubscribe("__keyevent@0__:expired", updateRoomOccupancyListener);

    console.log("[Redis] SubRedis listener set.");
}

export async function initRedis(): Promise<RedisClientType> {
    redisClient = createClient({
        url: `redis://${config.redis.host}:${config.redis.port}`
    });

    redisClient.on("error", (err) => {
        console.log("[Redis] Redis error:", err.message);
    });

    await redisClient.connect();

    console.log("[Redis] Redis connected.");

    return redisClient;
}

export function getRedis(): RedisClientType {
    if (!redisClient) {
        throw new Error("[Redis] Redis not initialized");
    }

    return redisClient;
}