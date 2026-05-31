import { ComponentLoader } from "adminjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const componentLoader = new ComponentLoader();

export const Components = {
    Dashboard: componentLoader.add(
        "Dashboard",
        path.join(__dirname, "./components/Dashboard.tsx"),
        "components"
    ),
    UploadFace: componentLoader.add(
        "UploadFace",
        path.join(__dirname, "./components/UploadFace.tsx"),
        "components"
    ),
    FaceEmbeddingField: componentLoader.add(
        "FaceEmbeddingField",
        path.join(__dirname, "./components/FaceEmbeddingField.tsx"),
        "components"
    ),
};
