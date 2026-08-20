import redis from "../config/redis.js";

const CACHE_PREFIX = "iot:device:";

export const OFFLINE_THRESHOLD = 30 * 1000;
export const SNAPSHOT_INTERVAL = 12 * 60 * 60 * 1000;

function getDeviceCacheKey(deviceId) {
    return `${CACHE_PREFIX}${deviceId}`;
}

export async function updateDeviceCache(deviceId, newData) {
    const key = getDeviceCacheKey(deviceId);

    const existing = await redis.get(key);

    let cached = {
        data: {},
        lastSeen: Date.now(),
        lastSaved: null,
        offlineSaved: false,
    };

    if (existing) {
        try {
            cached = JSON.parse(existing);
        } catch (err) {
            console.error(`❌ Failed to parse Redis cache for ${deviceId}`, err);
        }
    }

    const wasOffline = cached.offlineSaved === true;

    cached.data = {
        ...cached.data,
        ...newData,
    };

    cached.lastSeen = Date.now();

    // Device started sending telemetry again
    cached.offlineSaved = false;

    await redis.set(
        key,
        JSON.stringify(cached)
    );

    return {
        ...cached,
        wasOffline,
    };
}

export async function updateDeviceLastSeen(deviceId) {
    const key = getDeviceCacheKey(deviceId);

    const existing = await redis.get(key);

    if (!existing) {
        return {
            wasOffline: false,
        };
    }

    const cached = JSON.parse(existing);

    const wasOffline = cached.offlineSaved === true;

    cached.lastSeen = Date.now();
    cached.offlineSaved = false;

    await redis.set(
        key,
        JSON.stringify(cached)
    );

    return {
        wasOffline,
    };
}

export async function scanCachedDevices(
    processBatch,
    batchSize = 100
) {
    let cursor = "0";

    do {
        const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            `${CACHE_PREFIX}*`,
            "COUNT",
            batchSize
        );

        cursor = nextCursor;

        if (!keys.length) {
            continue;
        }

        const values = await redis.mget(keys);

        const devices = [];

        values.forEach((value, index) => {
            if (!value) return;

            try {
                const cached = JSON.parse(value);

                const deviceId = keys[index].replace(
                    CACHE_PREFIX,
                    ""
                );

                devices.push({
                    deviceId,
                    key: keys[index],
                    ...cached,
                });
            } catch (err) {
                console.error(
                    `❌ Failed to parse cache: ${keys[index]}`,
                    err
                );
            }
        });

        // Process this batch immediately
        if (devices.length > 0) {
            await processBatch(devices);
        }

    } while (cursor !== "0");
}


export async function markDeviceSnapshotSaved(deviceId) {
    const key = getDeviceCacheKey(deviceId);

    const existing = await redis.get(key);

    if (!existing) return;

    const cached = JSON.parse(existing);

    cached.lastSaved = Date.now();

    await redis.set(
        key,
        JSON.stringify(cached)
    );
}


export async function markDeviceOfflineSaved(deviceId) {
    const key = getDeviceCacheKey(deviceId);

    const existing = await redis.get(key);

    if (!existing) return;

    const cached = JSON.parse(existing);

    cached.offlineSaved = true;
    cached.lastSaved = Date.now();

    await redis.set(
        key,
        JSON.stringify(cached)
    );
}