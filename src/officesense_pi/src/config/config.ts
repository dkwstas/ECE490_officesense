import * as dotenv from "dotenv";
dotenv.config();

interface Config {
    api: {
        address: string;
        port: number;
    };
    mqtt: {
        host: string;
        port: number;
        username: string;
        password: string;
        topic: string;
    };
    redis: {
        host: string;
        port: number;
        password: string;
    };
    core: {
        hysteresis: number;
        candidateHysteresis: number;
        debounceMS: number;
        minSamples: number;
        transitionTTL: number;
        transitionCleanupInterval: number;
        lossThreshold: number;
        userTTL: number;
        verifyTimeout: number;
        cameraInterval: number;
    };
}

const config: Config = {
    api: {
        address: process.env.API_ADDRESS ?? "0.0.0.0",
        port: parseInt(process.env.API_PORT ?? "80"),
    },
    mqtt: {
        host: process.env.MQTT_HOST ?? "10.24.4.13",
        port: parseInt(process.env.MQTT_PORT ?? "1883"),
        username: process.env.MQTT_USERNAME ?? "user",
        password: process.env.MQTT_PASSWORD ?? "pass",
        topic: process.env.MQTT_TOPIC ?? "scanners/+",
    },
    redis: {
        host: process.env.REDIS_HOST ?? "10.24.4.13",
        port: parseInt(process.env.REDIS_PORT ?? "6379"),
        password: process.env.REDIS_PASSWORD ?? "redispassword",
    },
    core: {
        hysteresis: parseInt(process.env.CORE_HYSTERESIS ?? "6"),
        candidateHysteresis: parseInt(process.env.CORE_CANDIDATE_HYSTERESIS ?? "5"),
        debounceMS: parseInt(process.env.CORE_DEBOUNCE_MS ?? String(3 * 1000)),
        minSamples: parseInt(process.env.CORE_MIN_SAMPLES ?? "4"),
        transitionTTL: parseInt(process.env.CORE_TRANSITION_TTL ?? String(5 * 60 * 1000)),
        transitionCleanupInterval: parseInt(process.env.CORE_TRANSITION_CLEANUP_INTERVAL ?? String(60 * 1000)),
        lossThreshold: parseInt(process.env.CORE_LOSS_THRESHOLD ?? String(8 * 1000)),
        userTTL: parseInt(process.env.CORE_USER_TTL ?? String(3 * 60 * 1000)),
        verifyTimeout: parseInt(process.env.CORE_VERIFY_TIMEOUT ?? String(5 * 60 * 1000)),
        cameraInterval: parseInt(process.env.CORE_CAMERA_INTERVAL ?? String(5 * 1000)),
    },
};

export default config;