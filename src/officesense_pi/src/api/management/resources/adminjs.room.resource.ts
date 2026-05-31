import { prisma } from "../../../lib/prisma.js";
import { getModelByName } from "@adminjs/prisma";

export default {
    resource: {
        model: getModelByName("Room"),
        client: prisma,
    },
    options: {
        navigation: { icon: "Map" },
        listProperties: ["id", "name"],
        showProperties: ["id", "name"],
        editProperties: ["name"],
        filterProperties: ["name"],
    },
};
