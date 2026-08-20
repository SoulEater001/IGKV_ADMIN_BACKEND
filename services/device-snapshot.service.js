import {
    saveSensorData,
    updateDeviceStatus,
} from "./db.service.js";

import {
    scanCachedDevices,
    markDeviceSnapshotSaved,
    markDeviceOfflineSaved,
    OFFLINE_THRESHOLD,
    SNAPSHOT_INTERVAL,
} from "./device-cache.service.js";

let snapshotTimer = null;
let isSnapshotRunning = false;

async function checkDeviceSnapshots() {
    if (isSnapshotRunning) {
        console.log(
            "⏳ Previous snapshot check still running, skipping..."
        );

        return;
    }

    isSnapshotRunning = true;
    try {
        const now = Date.now();

        await scanCachedDevices(async (devices) => {

            console.log(
                `📦 Processing device batch: ${devices.length} devices`
            );

            for (const device of devices) {

                const {
                    deviceId,
                    data,
                    lastSeen,
                    lastSaved,
                    offlineSaved,
                } = device;

                if (!lastSeen) {
                    continue;
                }

                const timeSinceLastSeen =
                    now - lastSeen;


                /*
                 * CASE 1:
                 * Device stopped sending telemetry
                 */
                if (timeSinceLastSeen >= OFFLINE_THRESHOLD) {

                    if (!offlineSaved) {

                        console.log(
                            `🔴 Device offline: ${deviceId}`
                        );

                        if (
                            data &&
                            Object.keys(data).length > 0
                        ) {
                            await saveSensorData(
                                deviceId,
                                data
                            );

                            console.log(
                                `💾 Offline snapshot saved: ${deviceId}`
                            );
                        }

                        await updateDeviceStatus(
                            deviceId,
                            "OFFLINE"
                        );

                        await markDeviceOfflineSaved(
                            deviceId
                        );
                    }

                    continue;
                }


                /*
                 * CASE 2:
                 * Device is online.
                 * Save a snapshot every 12 hours.
                 */
                const shouldSaveSnapshot =
                    !lastSaved ||
                    now - lastSaved >= SNAPSHOT_INTERVAL;

                if (
                    shouldSaveSnapshot &&
                    data &&
                    Object.keys(data).length > 0
                ) {

                    console.log(
                        `💾 12-hour snapshot: ${deviceId}`
                    );

                    await saveSensorData(
                        deviceId,
                        data
                    );

                    await markDeviceSnapshotSaved(
                        deviceId
                    );
                }
            }

        });

    } catch (err) {

        console.error(
            "❌ Device snapshot worker error:",
            err
        );

    } finally {

        isSnapshotRunning = false;

    }
}


export function startDeviceSnapshotWorker() {

    if (snapshotTimer) {

        console.log(
            "⚠️ Device snapshot worker already running"
        );

        return;
    }

    console.log(
        "⏱️ Starting device snapshot worker"
    );


    snapshotTimer = setInterval(
        checkDeviceSnapshots,
        10 * 1000
    );


    // Run immediately on server startup
    checkDeviceSnapshots();
}