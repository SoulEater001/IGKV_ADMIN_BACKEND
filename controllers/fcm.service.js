// import { getMessaging } from "firebase-admin/messaging";
// import firebaseApp from "../config/firebase.js";

// export async function sendPush(token, payload) {
//   if (!token) {
//     console.warn("⚠️ No FCM token, skipping push");
//     return false;
//   }

//   const response = await getMessaging(firebaseApp).send({
//     token,
//     notification: payload.notification,
//     data: payload.data,
//   });

//   console.log("✅ Push sent:", response);

//   return true;
// }