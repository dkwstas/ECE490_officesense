import { getRedis } from "./redis.js";
import { prisma } from "../lib/prisma.js";
import { RoomTransition, transitions } from "./transition.js";
import config from "../config/config.js";

const adjectives = [
    "Crazy",
    "Silent",
    "Dark",
    "Fast",
    "Lucky",
    "Wild",
    "Epic"
];

const nouns = [
    "Tiger",
    "Wolf",
    "Falcon",
    "Shadow",
    "Ninja",
    "Dragon",
    "Phoenix"
];

function generateNickname() {
    const adjective =
        adjectives[Math.floor(Math.random() * adjectives.length)];

    const noun =
        nouns[Math.floor(Math.random() * nouns.length)];

    const number = Math.floor(Math.random() * 1000);

    return `${adjective}${noun}${number}`;
}

function newUser(): { pseudoID: string, psuedoName: string } {
    return {
        pseudoID: crypto.randomUUID(),
        psuedoName: generateNickname()
    };
}

export async function analyzeData(roomID: string, metrics: {
    tagID: string,
    rssi: number
}) {
    console.log(`\n=======================================================\n` +
        `ROOM_ID: ${roomID}\nTAG_ID: ${metrics.tagID}\nRSSI: ${metrics.rssi}\n` +
        `=======================================================\n`);

    const userID = (
        await prisma.tag.findUnique({
            where: { id: metrics.tagID },
            select: { userId: true },
        })
    )?.userId;

    console.log(`[SQLite] Resolved USER_ID: ${userID}`);

    if (!userID)
        return;

    const redis = getRedis();
    const res = await redis.get(`user:${userID}`);

    if (!res) {
        const user = newUser();
        console.log(`[Redis] Created USER: ${user.psuedoName} USER_ID: ${user.pseudoID}`);

        // trigger camera

        await redis.set(`user:${userID}`, JSON.stringify({
            userID: user.pseudoID,
            name: user.psuedoName,
            rssi: metrics.rssi,
            room: roomID,
            verified: false,
            timestamp: Date.now()
        }), { PX: config.core.userTTL });

        console.log("[Redis] Stored new user in redis.");

        return;
    }

    let resObj = JSON.parse(res);
    console.log(`[Redis] User exists in redis in ROOM_ID: ${resObj["room"]}`);

    if (roomID == resObj["room"]) {
        console.log("[Redis] Same room, updating redis...");
        resObj["rssi"] = metrics.rssi;
        resObj["timestamp"] = Date.now()

        await redis.set(`user:${userID}`, JSON.stringify(resObj), { PX: config.core.userTTL });

        return;
    }

    let transition = transitions.get(userID);

    if (!transition) {
        console.log("[!] Starting new transition");
        transition = new RoomTransition();
        transitions.set(userID, transition);
    }

    if (transition.shouldTransitionTo(roomID, metrics.rssi, resObj["rssi"], resObj["timestamp"])) {
        // trigger camera

        console.log(`[!] Transition done ${resObj["room"]} -> ${roomID}`);

        resObj["rssi"] = metrics.rssi;
        resObj["room"] = roomID;
        resObj["timestamp"] = Date.now()


        await redis.set(`user:${userID}`, JSON.stringify(resObj), { PX: config.core.userTTL });
    } else
        console.log("[!] Transition declined");
}