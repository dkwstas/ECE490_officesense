import { fileURLToPath } from "url";
import path from "path";
import { spawn } from "child_process";
import { getRedis } from "../redis/redis.js";
import { prisma } from "../lib/prisma.js";
import config from "../config/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execPath = "../../bin";
const binaryPath = path.join(__dirname, execPath, "cameraSession");

type InputPacket = {
    uuid: string;
    descriptor: number[];
};

type ResultPacket = {
    uuid: string;
    verified: boolean;
};

export async function getUnverifiedUserKeys(): Promise<string[]> {
    const redis = getRedis();

    const keys = await redis.keys("user:*");

    const unverified: string[] = [];

    await Promise.all(
        keys.map(async (key) => {
            const raw = await redis.get(key);
            if (!raw) return;
            const session = JSON.parse(raw);
            if (!session.verified) unverified.push(key.replace("user:", ""));
        })
    );

    return unverified;
}

export async function getUnverifiedUsersWithEmbeddings(): Promise<
    { uuid: string; descriptor: number[] }[]
> {
    const userIds = await getUnverifiedUserKeys();

    const users = await prisma.user.findMany({
        where: {
            id: { in: userIds },
            faceEmbedding: { not: null },
        },
        select: { id: true, faceEmbedding: true },
    });

    return users.map((user) => ({
        uuid: user.id,
        descriptor: JSON.parse(user.faceEmbedding!),
    }));
}

async function cameraSession(packets: InputPacket[]): Promise<ResultPacket[] | null> {
    return new Promise((resolve, reject) => {
        const proc = spawn(binaryPath, [], {
            cwd: path.join(__dirname, execPath),
        });
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (d) => (stdout += d));
        proc.stderr.on("data", (d) => (stderr += d));
        proc.stdin.on("error", () => {});

        proc.on("error", (err) => {
            reject(new Error(`Failed to start binary: ${err.message}`));
        });

        proc.on("close", (code) => {
            console.log("cameraSession exited with code", code);
            const trimmed = stdout.trim();
            if (trimmed === "no face found.") return resolve(null);
            if (code !== 0) return reject(new Error(stderr || `exited with code ${code}`));
            try {
                const results: ResultPacket[] = JSON.parse(trimmed);
                resolve(results);
            } catch (e) {
                reject(new Error(`Failed to parse output: ${trimmed}`));
            }
        });

        for (const packet of packets) {
            proc.stdin.write(JSON.stringify(packet) + "\n");
        }
        proc.stdin.end();
    });
}

const setUnverified = async (uuid: string) => {
    const redis = getRedis();
    const key = `user:${uuid}`;
    const raw = await redis.get(key);
    if (!raw) return;
    const session = JSON.parse(raw);
    session.verified = false;
    await redis.set(key, JSON.stringify(session), { KEEPTTL: true, XX: true });
    console.log(`[Camera] Unverified user ${uuid} due to timeout`);
};

const run = async () => {
    const redis = getRedis();

    try {
        const packets = await getUnverifiedUsersWithEmbeddings();
        if (packets.length > 0) {
            const results = await cameraSession(packets);
            if (results) {
                await Promise.all(
                    results.map(async (r) => {
                        if (!r.verified) return;
                        const key = `user:${r.uuid}`;
                        const raw = await redis.get(key);
                        if (!raw) return;
                        const session = JSON.parse(raw);
                        session.verified = true;
                        await redis.set(key, JSON.stringify(session), { KEEPTTL: true, XX: true });

                        setTimeout(() => setUnverified(r.uuid), config.core.verifyTimeout);

                        console.log(`[Camera] Verified user ${r.uuid}`);
                    })
                );
            }
        }
    } catch (e) {
        console.error("camera run error:", e);
    }
    setTimeout(run, config.core.cameraInterval);
};

export { run as initCamera };
