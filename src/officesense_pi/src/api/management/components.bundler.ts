import { ComponentLoader } from "adminjs";
import path from "path";
import * as url from "url";

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
export const componentLoader = new ComponentLoader();

const add = (filePath: string, componentName: string): string =>
    componentLoader.add(componentName, path.join(__dirname, filePath));

export const Components = {
    Dashboard: add("components/Dashboard", "Dashboard"),
    UploadFace: add("components/UploadFace", "UploadFace"),
    FaceEmbeddingField: add("components/FaceEmbeddingField", "FaceEmbeddingField"),
};
