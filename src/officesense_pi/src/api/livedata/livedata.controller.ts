import type { Request, Response, NextFunction } from "express";
import {
    getActiveUserData,
    getRedisRoomData,
    type RedisRoomData,
    type RedisUserData,
} from "./livedata.repository.js";
import { prisma } from "../../lib/prisma.js";

interface Params {
    urn: string;
}

type Relationship = {
    type: "Relationship";
    object: string;
};

type Property<T = any> = {
    type: "Property";
    value: T;
};

interface Entity {
    id: string;
    type: string;
    name: {
        type: "Property";
        value: string;
    };
}

interface User extends Entity {
    type: "User";
    locatedIn: Relationship;
    rssi: Property<number>;
    authenticationStatus: Property<string>;
    observedAt: Property<string>;
}

interface Room extends Entity {
    type: "Room";
    occupancy: Property<number>;
}

function convertToNGSIUser(user: RedisUserData): User {
    return {
        id: `urn:ngsi-ld:User:${user.userID}`,
        type: "User",
        name: {
            type: "Property",
            value: user.name,
        },
        locatedIn: {
            type: "Relationship",
            object: user.room,
        },
        rssi: {
            type: "Property",
            value: user.rssi,
        },
        authenticationStatus: {
            type: "Property",
            value: user.verified ? "verified" : "unverified",
        },
        observedAt: {
            type: "Property",
            value: new Date(user.timestamp).toISOString(),
        },
    };
}

async function convertToNGSIRoom(room: RedisRoomData): Promise<Room | null> {
    const roomName = await prisma.room.findUnique({
        where: { id: room.roomID },
        select: { name: true },
    });

    if (!roomName?.name) return null;

    return {
        id: `urn:ngsi-ld:Room:${room.roomID}`,
        type: "Room",
        name: {
            type: "Property",
            value: roomName.name,
        },
        occupancy: {
            type: "Property",
            value: room.occupancy,
        },
    };
}

async function getNGSIUsers(): Promise<User[]> {
    let users: User[] = [];

    const result: RedisUserData[] = await getActiveUserData();

    for (const r of result) {
        const user = convertToNGSIUser(r);

        users.push(user);
    }

    return users;
}

async function getNGSIRooms(): Promise<Room[]> {
    let rooms: Room[] = [];

    const result: RedisRoomData[] = await getRedisRoomData();

    for (const r of result) {
        const room = await convertToNGSIRoom(r);
        if (room == null) continue;

        rooms.push(room);
    }

    return rooms;
}

export async function getEntities(req: Request, res: Response, next: NextFunction) {
    if (Object.keys(req.query).length > 0) return next();

    let entities: Entity[] = [];

    entities.push(...(await getNGSIUsers()));
    entities.push(...(await getNGSIRooms()));

    return res.status(200).send(entities);
}

export async function getEntitiesOfType(req: Request, res: Response) {
    const { type } = req.query;

    switch (type) {
        case "user":
            return res.status(200).send(await getNGSIUsers());
        case "room":
            return res.status(200).send(await getNGSIRooms());
        default:
            return res.sendStatus(400);
    }
}

export async function getEntity(req: Request<Params>, res: Response) {
    const { urn } = req.params;

    if (!urn || !urn.startsWith("urn:ngsi-ld:")) return res.sendStatus(400);

    const entity = urn.slice(12);

    if (!entity) return res.sendStatus(400);

    if (entity.toLowerCase().startsWith("room:")) {
        const roomID = entity.slice(5);

        if (!roomID) return res.sendStatus(400);

        const data = await getRedisRoomData(roomID);

        if (!data.length) return res.sendStatus(404);

        return res.status(200).send(await convertToNGSIRoom(data[0]!));
    } else if (entity.toLowerCase().startsWith("user:")) {
        const userID = entity.slice(5);

        if (!userID) return res.sendStatus(400);

        const data = await getActiveUserData(userID);

        if (!data.length) return res.sendStatus(404);

        return res.status(200).send(convertToNGSIUser(data[0]!));
    } else return res.sendStatus(400);
}
