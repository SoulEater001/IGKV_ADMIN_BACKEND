import mqtt from "mqtt";

import {
  saveSensorData,
  updateDeviceStatus,
  updateHeartbeat,
  updateDeviceGps,
} from "../services/db.service.js";

//MQTT Broker URL
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";

//Websocket broadcast function
let wsBroadcast = null;

//MQTT Client Connect
const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: "node_backend",
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

//MQTT Connect
mqttClient.on("connect", () => {
  console.log("🔥 MQTT Connected →", MQTT_URL);

  const topics = [
    "devices/+/data",
    "devices/+/battery",
    "devices/+/heartbeat",
    "devices/+/status",
    "devices/+/network",
    "devices/+/gps",
  ];

  topics.forEach((t) => {
    mqttClient.subscribe(t, (err) => {
      if (err) console.log("❌ Subscribe Error:", t, err);
      else console.log("📡 Listening:", t);
    });
  });
});

//MQTT Message Handler
mqttClient.on("message", async (topic, payload) => {
  try {
    const msg = payload.toString();
    const parts = topic.split("/");
    const deviceId = parts[1];
    const msgType = parts[2]; // data / battery / heartbeat / status / network /gps

    // Try JSON parse
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      data = msg; // for "online"/"offline"
    }

    console.log(`📩 MQTT Message → ${topic}`, data);

    //Save only sensor data
    switch (msgType) {
      case "status": {
        const newStatus = data.toString().toUpperCase();

        await updateDeviceStatus(deviceId, newStatus).catch(console.log);

        await handleDeviceStatus(deviceId, newStatus);

        break;
      }
      case "heartbeat": {
        await updateHeartbeat(deviceId).catch((err) =>
          console.log("❌ updateHeartbeat error:", err),
        );

        await clearNotification(deviceId, "offline");

        break;
      }
      case "data":
        if (typeof data === "object") {
          await saveSensorData(deviceId, data).catch((err) =>
            console.log("❌ saveSensorData error:", err),
          );
        }
        break;
      case "battery": {
        let batteryPercent = null;

        if (typeof data === "object" && typeof data.battery === "number") {
          batteryPercent = data.battery; 
        } else if (typeof data === "number") {
          batteryPercent = data;
        }

        if (batteryPercent !== null) {
          await handleLowBattery(deviceId, batteryPercent);
        }

        break;
      }
      case "gps":
        if (typeof data === "object" && data.status === "ok") {
          const { lat, lng } = data;

          if (typeof lat === "number" && typeof lng === "number") {
            updateDeviceGps(deviceId, lat, lng).catch(console.log);
          }
        }
        break;
    }

    //forward data to all websocket
    if (wsBroadcast) {
      wsBroadcast({
        topic,
        type: msgType,
        data,
        deviceId,
      });
    }
  } catch (err) {
    console.log("❌ MQTT message error:", err);
  }
});

//send command to device
function sendCommand(deviceId, obj) {
  const topic = `devices/${deviceId}/command`;
  mqttClient.publish(topic, JSON.stringify(obj));
  console.log("➡️ Sent command:", topic, obj);
}

//Attach wsBroadcast for websocket server
function attachWebSocketBroadcast(fn) {
  wsBroadcast = fn;
}

export {
  mqttClient,
  sendCommand,
  attachWebSocketBroadcast,
};
