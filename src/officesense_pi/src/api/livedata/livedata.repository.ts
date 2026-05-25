import { prisma } from "../../lib/prisma.js";
import { getRedis } from "../../redis/redis.js";

export interface RedisUserData {
    userID: string;
    name: string;
    rssi: number;
    room: string;
    verified: boolean;
    timestamp: number;
}

export interface RedisRoomData {
    roomID: string;
    occupancy: number;
}

export async function getActiveUserData(userID?: string): Promise<RedisUserData[]> {
    const redis = getRedis();

    if (!userID) {
        let cursor = "0";
        let result: RedisUserData[] = [];

        do {
            const res = await redis.scan(cursor, {
                MATCH: "user:*",
                COUNT: 100,
            });

            cursor = res.cursor;

            const values = await Promise.all(
                res.keys.map((key) => redis.get(key))
            );

            result.push(...values
                .filter((v): v is string => v !== null)
                .map((v) => JSON.parse(v))
            );

        } while (cursor !== "0");

        return result;
    }

    const _userID = await redis.get(`_user:${userID}`);

    if (!_userID) return [];

    const res = await redis.get(`user:${_userID}`);

    if (!res) return [];

    const resObj: RedisUserData = JSON.parse(res);

    return [resObj];
}

export async function getRedisRoomData(roomID?: string): Promise<RedisRoomData[]> {
    const redis = getRedis();

    if (!roomID) {
        let cursor = "0";
        let result: RedisRoomData[] = [];

        do {
            const res = await redis.scan(cursor, {
                MATCH: "room:*",
                COUNT: 100,
            });

            cursor = res.cursor;

            const values = await Promise.all(
                res.keys.map(async (key) => ({
                    roomID: key,
                    occupancy: await redis.get(key),
                }))
            );

            result.push(...values
                .filter((v) => v.occupancy !== null)
                .map((v) => ({
                    roomID: v.roomID.slice(5),
                    occupancy: Number(v.occupancy),
                }))
            );

        } while (cursor !== "0");

        return result;
    }

    const res = await redis.get(`room:${roomID}`);

    if (!res) return [];

    return [{ roomID: roomID, occupancy: Number(res) }];
}

export async function getRoomIDs(): Promise<{ id: string; }[]> {
    return await prisma.room.findMany({
        select: { id: true }
    });
}