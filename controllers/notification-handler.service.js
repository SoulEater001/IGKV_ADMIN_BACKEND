import { tryNotify, clearNotification } from "./notification.service.js";

import {
    getFcmTokensByUser,
    getUserAndDeviceNameByDeviceId,
    storeNotification,
} from "../services/db.service.js";

/**
 * Handle device status change notifications
 */
export async function handleDeviceStatus(deviceId, status) {
    if (status === "OFFLINE") {
        const info = await getUserAndDeviceNameByDeviceId(deviceId);
        if (!info) return;

        const { mobileNo, deviceName } = info;
        const tokens = await getFcmTokensByUser(mobileNo);

        let notificationStored = false;

        for (const token of tokens) {
            const sent = await tryNotify({
                deviceId,
                type: "offline",
                token,
                payload: {
                    notification: {
                        title: "Device Offline",
                        body: `${deviceName} is offline`,
                    },
                    data: {
                        type: "alert",
                        deviceId,
                    },
                },
            });

            if (sent && !notificationStored) {
                await storeNotification({
                    deviceId,
                    deviceName,
                    mobileNo,
                    type: "alert",
                    title: "Device Offline",
                    message: `${deviceName} is offline`,
                });

                notificationStored = true;
            }
        }
    }

    if (status === "ONLINE") {
        await clearNotification(deviceId, "offline");
    }
}

/**
 * Handle low battery notification
 */
export async function handleLowBattery(deviceId, batteryPercent) {
    if (batteryPercent >= 15) {
        await clearNotification(deviceId, "low_battery");
        return;
    }

    const info = await getUserAndDeviceNameByDeviceId(deviceId);
    if (!info) return;

    const { mobileNo, deviceName } = info;
    const tokens = await getFcmTokensByUser(mobileNo);

    let notificationStored = false;

    for (const token of tokens) {
        const sent = await tryNotify({
            deviceId,
            type: "low_battery",
            token,
            payload: {
                notification: {
                    title: "Low Battery Alert",
                    body: `${deviceName} battery is at ${batteryPercent}%`,
                },
                data: {
                    type: "warning",
                    deviceId,
                    battery: batteryPercent.toString(),
                },
            },
        });

        if (sent && !notificationStored) {
            await storeNotification({
                deviceId,
                deviceName,
                mobileNo,
                type: "warning",
                title: "Low Battery Alert",
                message: `${deviceName} battery is at ${batteryPercent}%`,
            });

            notificationStored = true;
        }
    }
}
