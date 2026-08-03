import WebSocket from "ws";
import { attachWebSocketBroadcast, sendCommand } from "../middleware/mqttClient.js";
import { updateDeviceInterval } from "../services/db.service.js";

function initWS(server) {
  // Create WebSocket server on top of the existing HTTP server
  const wss = new WebSocket.Server({ server });

  console.log("✔ WebSocket Server Running");

  // Handle new WebSocket client connection
  wss.on("connection", (ws) => {
    console.log("🌐 WebSocket client connected");

    // Track subscribed deviceIds for this client
    ws.role = "app"; // 🔑 default role
    ws.deviceId = null;
    ws.subscriptions = new Set();

    // Handle incoming messages from client
    ws.on("message", (msg) => {
      try {
        const obj = JSON.parse(msg);

        // SUBSCRIBE to device data
        if (obj.subscribe) {
          if (Array.isArray(obj.subscribe)) {
            obj.subscribe.forEach((id) => ws.subscriptions.add(id));
          } else {
            ws.subscriptions.add(obj.subscribe);
            console.log("Client Subscribed ->> " + obj.subscribe);
          }

          ws.send(JSON.stringify({ subscribed: Array.from(ws.subscriptions) }));
          return;
        }

        // SEND COMMAND to IoT device
        if (obj.deviceId && obj.command) {
          if (obj.command.interval) {
            updateDeviceInterval(obj.deviceId, obj.command.interval)
              .then(() => {
                console.log(
                  `📝 Interval saved for ${obj.deviceId}: ${obj.command.interval}ms`,
                );
              })
              .catch((e) => console.log("❌ updateDeviceInterval error:", e));
          }
          sendCommand(obj.deviceId, obj.command);
          ws.send(JSON.stringify({ ok: true }));
          return;
        }

        // UNSUBSCRIBE from device data
        if (obj.unsubscribe) {
          if (Array.isArray(obj.unsubscribe)) {
            obj.unsubscribe.forEach((id) => ws.subscriptions.delete(id));
          } else {
            ws.subscriptions.delete(obj.unsubscribe);
            console.log("Client Un-Subscribed ->> " + obj.unsubscribe);
          }

          ws.send(
            JSON.stringify({ unsubscribed: Array.from(ws.subscriptions) }),
          );
          return;
        }
      } catch (e) {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  });

  // MQTT → WS bridge (send data to subscribed WS clients)
  attachWebSocketBroadcast(({ topic, data, deviceId }) => {
    const type = topic.split("/")[2];

    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && ws.subscriptions.has(deviceId)) {
        ws.send(
          JSON.stringify({
            deviceId,
            type,
            data,
          }),
        );
      }
    });
  });
}

export default initWS;
