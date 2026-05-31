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
    };
}

const config: Config = {
    api: {
        address: "0.0.0.0",
        port: 80,
    },
    mqtt: {
        host: "192.168.1.2",
        port: 1883,
        username: "user",
        password: "pass",
        topic: "scanners/+",
    },
    redis: {
        host: "192.168.1.2",
        port: 6379,
    },
    core: {
        hysteresis: 6,
        candidateHysteresis: 3,
        debounceMS: 3000,
        minSamples: 4,
        transitionTTL: 5 * 60 * 1000,
        transitionCleanupInterval: 60 * 1000,
        lossThreshold: 5000,
        userTTL: 3 * 60 * 1000,
        verifyTimeout: 30 * 1000
    },
}

export default config;