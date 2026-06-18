import { bundle } from "@adminjs/bundler";
import { componentLoader } from "./components.bundler.js";

void (async () => {
    await bundle({
        componentLoader,
        destinationDir: "./.adminjs",
    });
})();
