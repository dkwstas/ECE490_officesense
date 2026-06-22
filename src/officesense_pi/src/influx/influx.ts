import { InfluxDB, type WriteApi } from "@influxdata/influxdb-client";
import config from "../config/config.js";

let writeApi: WriteApi | null = null;

export function initInflux(): void {
    const client = new InfluxDB({
        url: config.influx.url,
        token: config.influx.token,
    });

    writeApi = client.getWriteApi(config.influx.org, config.influx.bucket, "ms");

    writeApi.useDefaultTags({ host: "officesense-pi" });

    console.log("[InfluxDB] Write API initialized.");
}

export function getInflux(): WriteApi {
    if (!writeApi) throw new Error("[InfluxDB] Not initialized. Call initInflux() first.");
    return writeApi;
}
