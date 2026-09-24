// import redis from "../config/redis.js";
// import { sendPush } from "./fcm.service.js";

// const COOLDOWN = {
//   offline: 30 * 60,
//   low_battery: 6 * 60 * 60,
//   sensor_critical: 15 * 60,
//   advisory: 24 * 60 * 60,
// };

// export async function tryNotify({ deviceId, type, token, payload }) {
//   const key = `${deviceId}:${type}`;
//   const ttl = COOLDOWN[type] ?? 900;

//   const alreadySent = await redis.get(key);
//   if (alreadySent) {
//     console.log(`⏳ Skipping ${key}, cooldown active`);
//     return false;
//   }

//   try {
//     await sendPush(token, payload);
//   } catch (err) {
//     console.error("❌ Push failed:", err.message);
//     return false; 
//   }

//   await redis.set(key, Date.now(), "EX", ttl);
//   console.log(`🔔 Notification sent: ${key}`);

//   return true;
// }

// export async function clearNotification(deviceId, type) {
//   const key = `${deviceId}:${type}`;

//   const exists = await redis.exists(key);
//   if (!exists) return;

//   await redis.del(key);
//   console.log(`🧹 Cleared notification state: ${key}`);
// }
