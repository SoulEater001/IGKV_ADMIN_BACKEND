import "dotenv/config";
import mqtt from "mqtt";
import {
  saveSensorData,
  updateDeviceStatus,
  updateHeartbeat,
  updateDeviceGps,
} from "../services/db.service.js";
import { clearNotification } from "../controllers/notification.service.js";
import {
  handleDeviceStatus,
  handleLowBattery,
} from "../controllers/notification-handler.service.js";
import { updateDeviceCache, updateDeviceLastSeen } from "../services/device-cache.service.js";

const MQTT_URL =
  process.env.MQTT_URL || "mqtts://mqtt.tadobaiot.com:8883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "tadoba-mqtt";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "tadoba2018";

let mqttClient = null;
let wsBroadcast = null;

export function initMQTT() {
  if (mqttClient) {
    console.log("⚠️ MQTT client already initialized");
    return mqttClient;
  }

  console.log("=".repeat(60));
  console.log("MQTT Configuration");
  console.log("URL:", MQTT_URL);
  console.log("Username:", MQTT_USERNAME);
  console.log("=".repeat(60));

  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `node_backend_${Math.random()
      .toString(16)
      .substring(2, 10)}`,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
    keepalive: 60,
    clean: true,
    rejectUnauthorized: false,
    protocol: "mqtts",
    port: 8883,
    host: "mqtt.tadobaiot.com",
  });

  mqttClient.on("connect", () => {
    console.log("🔥 MQTT Connected →", MQTT_URL);
    // const topics = [
    //   "#",
    //   "devices/+/data",
    //   "devices/+/battery",
    //   "devices/+/heartbeat",
    //   "devices/+/status",
    //   "devices/+/network",
    //   "devices/+/gps",
    //   "devices/+/telemetry",
    //   "devices/+/location",
    //   "devices/+/health",
    // ];

    const topics = ['#']
    topics.forEach((topic) => {
      mqttClient.subscribe(topic, (err) => {
        if (err) {
          console.log("❌ Subscribe Error:", topic, err);
        } else {
          console.log("📡 Listening:", topic);
        }
      });
    });
    // mqttClient.subscribe("#", (err) => {
    //   if (err) console.log("❌ Subscribe Error:", err);
    //   else console.log("📡 Listening: #");
    // });
  });

  mqttClient.on("error", (err) =>
    console.error("❌ MQTT Error:", err.message)
  );

  mqttClient.on("offline", () =>
    console.log("⚠️ MQTT Client Offline")
  );

  mqttClient.on("reconnect", () =>
    console.log("🔄 MQTT Reconnecting...")
  );

  mqttClient.on("close", () =>
    console.log("🔌 MQTT Connection Closed")
  );

  mqttClient.on("message", async (topic, payload) => {
    try {
      const msg = payload.toString();
      const [, deviceId, msgType = "unknown"] = topic.split("/");

      let data;
      try {
        data = JSON.parse(msg);
      } catch {
        data = msg;
      }

      // console.log(`📩 MQTT → ${topic}`, data);

      switch (msgType) {
        case "status": {
          const status = data.toString().toUpperCase();

          await updateDeviceStatus(deviceId, status).catch(console.log);
          await handleDeviceStatus(deviceId, status);

          console.log(`📱 ${deviceId} status: ${status}`);
          break;
        }

        case "heartbeat":
          await updateHeartbeat(deviceId).catch(console.log);
          const cacheResult = await updateDeviceLastSeen(deviceId);
          if (cacheResult.wasOffline) {
            console.log(`🟢 Device back online: ${deviceId}`);

            await updateDeviceStatus(deviceId,"ONLINE");
          }
          await clearNotification(deviceId, "offline");
          console.log(`💓 ${deviceId} heartbeat received`);
          break;

        case "data":
        case "telemetry": {
          if (typeof data === "object" && data !== null) {
            const mappedData = mapHardwareToDatabase(data);

            if (Object.keys(mappedData).length > 0) {
              // await saveSensorData(deviceId, mappedData);

              const cacheResult = await updateDeviceCache(deviceId, mappedData);
              if (cacheResult.wasOffline) {

                console.log(`🟢 Device back online: ${deviceId}`);

                await updateDeviceStatus(deviceId, "ONLINE");
              }

              // console.log(`📦 Cached ${Object.keys(mappedData).length} readings for ${deviceId}`);

              if (wsBroadcast) {
                wsBroadcast({
                  topic,
                  type: msgType,
                  data: mappedData,
                  deviceId,
                });
              }
            }
          }

          return;
        }

        case "battery": {
          const batteryPercent =
            typeof data === "object" && data !== null
              ? data.battery
              : data;

          if (typeof batteryPercent === "number") {
            await handleLowBattery(deviceId, batteryPercent);
          }
          break;
        }

        case "gps":
        case "location": {
          if (typeof data === "object" && data !== null) {
            const lat = data.lat ?? data.latitude;
            const lng = data.lng ?? data.longitude;

            if (typeof lat === "number" && typeof lng === "number") {
              await updateDeviceGps(deviceId, lat, lng);
              console.log(`📍 ${deviceId} GPS: ${lat}, ${lng}`);
            }
          }
          break;
        }

        case "health": {
          if (typeof data === "object" && data !== null) {
            const mappedData = mapHardwareToDatabase(data);

            if (Object.keys(mappedData).length) {
              // await saveSensorData(deviceId, mappedData).catch((err) =>
              //   console.log("❌ Health save error:", err)
              // );
            }

            if (typeof data.batteryPercentage === "number") {
              await handleLowBattery(
                deviceId,
                data.batteryPercentage
              );
            }

            if (data.signalStrength !== undefined) {
              console.log(
                `📶 ${deviceId} signal: ${data.signalStrength}`
              );
            }
          }
          break;
        }

        default: {
          console.log(`⚠️ Unknown MQTT message type: ${msgType}`);

          if (typeof data === "object" && data !== null) {
            const mappedData = mapHardwareToDatabase(data);

            if (Object.keys(mappedData).length) {
              // await saveSensorData(deviceId, mappedData).catch((err) =>
              //   console.log("❌ saveSensorData error:", err)
              // );
            }
          }
        }
      }

      if (wsBroadcast) {
        wsBroadcast({
          topic,
          type: msgType,
          data,
          deviceId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.log("❌ MQTT message error:", err.message);
    }
  });

  return mqttClient;
}

function mapHardwareToDatabase(data) {
  const mapped = {};

  if (data.nitrogen !== undefined) mapped.n = data.nitrogen;
  if (data.phosphorus !== undefined) mapped.p = data.phosphorus;
  if (data.potassium !== undefined) mapped.k = data.potassium;

  if (data.soil_moisture1 !== undefined) mapped.sml1 = data.soil_moisture1;
  if (data.soil_moisture2 !== undefined) mapped.sml2 = data.soil_moisture2;
  if (data.soil_moisture3 !== undefined) mapped.sml3 = data.soil_moisture3;

  if (data.soil_temperature1 !== undefined) mapped.stl1 = data.soil_temperature1;
  if (data.soil_temperature2 !== undefined) mapped.stl2 = data.soil_temperature2;
  if (data.soil_temperature3 !== undefined) mapped.stl3 = data.soil_temperature3;

  if (data.temperature !== undefined) mapped.temperature = data.temperature;
  if (data.humidity !== undefined) mapped.humidity = data.humidity;
  if (data.wind_speed !== undefined) mapped.wind = data.wind_speed;
  if (data.rainfall !== undefined) mapped.rain = data.rainfall;

  if (data.batteryPercentage !== undefined) {
    mapped.battery = data.batteryPercentage;
  }

  if (data.batteryVoltage !== undefined) {
    mapped.battery_voltage = data.batteryVoltage;
  }

  if (data.signalStrength !== undefined) {
    mapped.network_strength = Math.abs(data.signalStrength);
  }

  return mapped;
}

export function sendCommand(deviceId, obj) {
  if (!mqttClient) {
    throw new Error(
      "MQTT client is not initialized. Call initMQTT() first."
    );
  }

  const topic = `devices/${deviceId}/command`;

  mqttClient.publish(topic, JSON.stringify(obj), (err) => {
    if (err) {
      console.log("❌ MQTT publish error:", err);
    } else {
      console.log("➡️ Sent command:", topic, obj);
    }
  });
}

export function attachWebSocketBroadcast(fn) {
  wsBroadcast = fn;
}