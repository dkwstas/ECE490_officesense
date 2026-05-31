import { getRedis } from "../redis/redis.js";
import { prisma } from "../lib/prisma.js";
import { RoomTransition, transitions } from "./transition.js";
import config from "../config/config.js";
import { type RedisUserData } from "../api/livedata/livedata.repository.js";

const adjectives = ["Crazy", "Silent", "Dark", "Fast", "Lucky", "Wild", "Epic"];

const nouns = ["Tiger", "Wolf", "Falcon", "Shadow", "Ninja", "Dragon", "Phoenix"];

const running = new Set<string>();
const userRooms = new Map<string, string>();
const userPseudo = new Map<string, string>();

export async function updateRoomOccupancyListener(message: string, channel: string) {
    console.log(`[Redis] Key ${message} expired.`);

    const id = message.startsWith("user:") ? message.slice(5) : message;
    const lastRoomID = userRooms.get(id);
    const userPseudoID = userPseudo.get(id);

    const redis = getRedis();

    if (!lastRoomID) {
        console.log("[!] Key not found in local map");
    } else {
        await redis.decr(`room:${lastRoomID}`);
    }

    await redis.del(`_user:${userPseudoID}`);

    userRooms.delete(id);
    userPseudo.delete(id);
}

function generateNickname() {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];

    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    const number = Math.floor(Math.random() * 1000);

    return `${adjective}${noun}${number}`;
}

function newUser(): { pseudoID: string; psuedoName: string } {
    return {
        pseudoID: crypto.randomUUID(),
        psuedoName: generateNickname(),
    };
}

export async function analyzeData(
    roomID: string,
    metrics: {
        tagID: string;
        rssi: number;
    }
) {
    if (running.has(metrics.tagID)) {
        console.log(`[!] Skipping TAG_ID: ${metrics.tagID} already in process.`);
        return;
    }

    running.add(metrics.tagID);

    try {
        console.log(
            `\n=======================================================\n` +
                `ROOM_ID: ${roomID}\nTAG_ID: ${metrics.tagID}\nRSSI: ${metrics.rssi}\n` +
                `=======================================================\n`
        );

        const userID = (
            await prisma.tag.findUnique({
                where: { id: metrics.tagID },
                select: { userId: true },
            })
        )?.userId;

        console.log(`[SQLite] Resolved USER_ID: ${userID}`);

        if (!userID) return;

        const redis = getRedis();
        const res = await redis.get(`user:${userID}`);

        if (!res) {
            const user = newUser();
            console.log(`[Redis] Created USER: ${user.psuedoName} USER_ID: ${user.pseudoID}`);

            await redis.set(
                `user:${userID}`,
                JSON.stringify({
                    userID: user.pseudoID,
                    name: user.psuedoName,
                    rssi: metrics.rssi,
                    room: roomID,
                    verified: false,
                    timestamp: Date.now(),
                }),
                { PX: config.core.userTTL }
            );

            await redis.set(`_user:${user.pseudoID}`, userID);

            await redis.incr(`room:${roomID}`);

            userRooms.set(userID, roomID);
            userPseudo.set(userID, user.pseudoID);

            console.log("[Redis] Stored new user in redis.");

            return;
        }

        let resObj: RedisUserData = JSON.parse(res);
        console.log(`[Redis] User exists in redis in ROOM_ID: ${resObj["room"]}`);

        if (roomID == resObj["room"]) {
            console.log("[Redis] Same room, updating redis...");
            resObj["rssi"] = metrics.rssi;
            resObj["timestamp"] = Date.now();

            await redis.set(`user:${userID}`, JSON.stringify(resObj), { PX: config.core.userTTL });

            return;
        }

        let transition = transitions.get(userID);

        if (!transition) {
            console.log("[!] Starting new transition");
            transition = new RoomTransition();
            transitions.set(userID, transition);
        }

        if (
            transition.shouldTransitionTo(roomID, metrics.rssi, resObj["rssi"], resObj["timestamp"])
        ) {
            console.log(`[!] Transition done ${resObj["room"]} -> ${roomID}`);

            await redis.decr(`room:${resObj["room"]}`);
            await redis.incr(`room:${roomID}`);

            userRooms.set(userID, roomID);

            resObj["rssi"] = metrics.rssi;
            resObj["room"] = roomID;
            resObj["timestamp"] = Date.now();
            resObj["verified"] = false;

            await redis.set(`user:${userID}`, JSON.stringify(resObj), { PX: config.core.userTTL });
        } else console.log("[!] Transition declined");
    } finally {
        running.delete(metrics.tagID);
    }
}
