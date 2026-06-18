import { createClient, type RedisClientType } from "redis";
import config from "../config/config.js";
import { updateRoomOccupancyListener } from "../core/analyze.js";

let redisClient: RedisClientType;
let subRedisClient: RedisClientType;

const redisOptions = {
    socket: {
        host: config.redis.host,
        port: config.redis.port,
    },
    password: config.redis.password,
};

export async function initSubRedis(): Promise<void> {
    subRedisClient = createClient(redisOptions);

    subRedisClient.on("error", (err) => {
        console.log("[Redis] SubRedis error:", err.message);
    });

    await subRedisClient.connect();

    console.log("[Redis] SubRedis connected.");

    subRedisClient.pSubscribe("__keyevent@0__:expired", updateRoomOccupancyListener);

    console.log("[Redis] SubRedis listener set.");
}

export async function initRedis(): Promise<RedisClientType> {
    redisClient = createClient(redisOptions);

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
