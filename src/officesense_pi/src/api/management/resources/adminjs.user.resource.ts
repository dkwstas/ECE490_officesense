import { prisma } from "../../../lib/prisma.js";
import { getModelByName } from "@adminjs/prisma";
import { spawn } from "child_process";
import { Components } from "../components.js";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execPath = "../../../../bin";
const binaryPath = path.join(__dirname, execPath, "extractEmbeddings");

async function extractEmbedding(base64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn(binaryPath, [], {
            cwd: path.join(__dirname, execPath),
        });
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (d) => (stdout += d));
        proc.stderr.on("data", (d) => (stderr += d));

        proc.stdin.on("error", (err) => {});

        proc.on("error", (err) => {
            reject(new Error(`Failed to start binary: ${err.message}`));
        });

        proc.on("close", (code) => {
            console.log("extractEmbeddings exited with code", code);
            console.log("stdout:", stdout);
            console.log("stderr:", stderr);
            if (code !== 0) return reject(new Error(stderr || `exited with code ${code}`));
            try {
                const result = JSON.parse(stdout);
                if (!result.success) return reject(new Error(result.error));
                resolve(JSON.stringify(result.descriptor));
            } catch (e) {
                reject(new Error(`Failed to parse output: ${stdout}`));
            }
        });

        proc.stdin.write(base64);
        proc.stdin.end();
    });
}

export default {
    resource: {
        model: getModelByName("User"),
        client: prisma,
    },
    options: {
        titleProperty: "id",
        navigation: { icon: "User" },
        listProperties: ["id", "firstName", "lastName"],
        showProperties: ["id", "firstName", "lastName", "faceEmbedding"],
        editProperties: ["firstName", "lastName"],
        filterProperties: ["firstName", "lastName"],
        properties: {
            faceEmbedding: {
                isVisible: { list: false, show: true, edit: false, filter: false },
                type: "string",
                components: {
                    list: Components.FaceEmbeddingField,
                    show: Components.FaceEmbeddingField,
                },
            },
        },
        actions: {
            uploadFace: {
                actionType: "record",
                icon: "Camera",
                label: "Upload face",
                showInDrawer: true,
                handler: async (request: any, response: any, context: any) => {
                    const { record, currentAdmin } = context;
                    if (request.method === "post") {
                        const { base64 } = request.payload;
                        if (!base64) {
                            return {
                                record: record.toJSON(currentAdmin),
                                notice: { message: "No image provided", type: "error" },
                            };
                        }
                        try {
                            const embedding = await extractEmbedding(base64);
                            await prisma.user.update({
                                where: { id: record.params.id },
                                data: { faceEmbedding: embedding },
                            });
                            return {
                                record: record.toJSON(currentAdmin),
                                notice: { message: "Face embedding saved!", type: "success" },
                            };
                        } catch (e: any) {
                            return {
                                record: record.toJSON(currentAdmin),
                                notice: { message: `Failed: ${e.message}`, type: "error" },
                            };
                        }
                    }
                    return { record: record.toJSON(currentAdmin) };
                },
                component: Components.UploadFace,
            },
        },
    },
};
