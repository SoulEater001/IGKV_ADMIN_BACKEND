import { initializeApp, cert } from "firebase-admin/app";
import serviceAccount from "./farmeyeplus-firebase-adminsdk-fbsvc-04bb3ab7e6.json" with { type: "json" };

const admin = initializeApp({
  credential: cert(serviceAccount),
});

export default admin;