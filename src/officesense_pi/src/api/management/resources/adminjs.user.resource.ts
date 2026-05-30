import { prisma } from "../../../lib/prisma.js";
import { getModelByName } from "@adminjs/prisma";

export default {
    resource: {
        model: getModelByName("User"),
        client: prisma,
    },
    options: {
        titleProperty: "id",
        navigation: { icon: "User" },
        listProperties: ["id", "firstName", "lastName"],
        showProperties: ["id", "firstName", "lastName"],
        editProperties: ["firstName", "lastName"],
        filterProperties: ["firstName", "lastName"],
        properties: {
            faceEmbedding: {
                isVisible: false,
                type: "string"
            },
        }
    },
}