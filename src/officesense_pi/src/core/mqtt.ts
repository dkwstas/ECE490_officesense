import mqtt, { MqttClient } from "mqtt";
import config from "../config/config.js";
import { analyzeData } from "./analyze.js";

function initMqtt(): Promise<MqttClient> {
    return new Promise((resolve, reject) => {
        const client = mqtt.connect(
            `mqtt://${config.mqtt.host}:${config.mqtt.port}`,
            {
                username: config.mqtt.username,
                password: config.mqtt.password
            }
        );

        client.once("connect", () => {
            console.log("MQTT connected.");

            client.subscribe(config.mqtt.topic, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log("MQTT subscribed.");
                    resolve(client);
                }
            });
        });

        client.once("error", (err) => {
            reject(err);
        });
    });
}

export async function start() {
    try {
        const mqttClient = await initMqtt();

        mqttClient.on("message", (topic, message) => {
            analyzeData(topic.split("/").pop()!, JSON.parse(message.toString()));
        });

        mqttClient.on("error", (err) => {
            console.log(err.message);
        })
    } catch (err: any) {
        console.log("MQTT connection failed:", err.message);
    }
}
