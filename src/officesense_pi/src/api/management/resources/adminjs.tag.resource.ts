import { prisma } from "../../../lib/prisma.js";
import { getModelByName } from "@adminjs/prisma";

export default {
    resource: {
        model: getModelByName("Tag"),
        client: prisma,
    },
    options: {
        navigation: { icon: "Tag" },
        listProperties: ["id", "user"],
        showProperties: ["id", "user"],
        editProperties: ["user"],
        filterProperties: ["user"],
        properties: {
            user: {
                reference: "User",
            },
        },
    },
}