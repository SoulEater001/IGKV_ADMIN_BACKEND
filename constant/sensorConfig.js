// constants/sensorConfig.js

export const SENSOR_CONFIG = {
    n: {
        key: "n",
        name: "Nitrogen",
        unit: "mg/kg",
        type: "soil_nutrient",
        thresholds: {
            low: 20,
            optimalMin: 40,
            optimalMax: 80,
            high: 120
        },
        source: "Demo values - replace with crop/soil-specific recommendation"
    },

    p: {
        key: "p",
        name: "Phosphorus",
        unit: "mg/kg",
        type: "soil_nutrient",
        thresholds: {
            low: 10,
            optimalMin: 20,
            optimalMax: 50,
            high: 80
        },
        source: "Demo values - replace with crop/soil-specific recommendation"
    },

    k: {
        key: "k",
        name: "Potassium",
        unit: "mg/kg",
        type: "soil_nutrient",
        thresholds: {
            low: 50,
            optimalMin: 100,
            optimalMax: 200,
            high: 300
        },
        source: "Demo values - replace with crop/soil-specific recommendation"
    },

    sml1: {
        key: "sml1",
        name: "Soil Moisture 1",
        unit: "%",
        type: "soil_moisture",
        thresholds: {
            low: 20,
            optimalMin: 30,
            optimalMax: 60,
            high: 80
        },
        source: "Demo values"
    },

    sml2: {
        key: "sml2",
        name: "Soil Moisture 2",
        unit: "%",
        type: "soil_moisture",
        thresholds: {
            low: 20,
            optimalMin: 30,
            optimalMax: 60,
            high: 80
        },
        source: "Demo values"
    },

    sml3: {
        key: "sml3",
        name: "Soil Moisture 3",
        unit: "%",
        type: "soil_moisture",
        thresholds: {
            low: 20,
            optimalMin: 30,
            optimalMax: 60,
            high: 80
        },
        source: "Demo values"
    },

    stl1: {
        key: "stl1",
        name: "Soil Temperature 1",
        unit: "°C",
        type: "soil_temperature",
        thresholds: {
            low: 10,
            optimalMin: 18,
            optimalMax: 28,
            high: 35
        },
        source: "Demo values"
    },

    stl2: {
        key: "stl2",
        name: "Soil Temperature 2",
        unit: "°C",
        type: "soil_temperature",
        thresholds: {
            low: 10,
            optimalMin: 18,
            optimalMax: 28,
            high: 35
        },
        source: "Demo values"
    },

    stl3: {
        key: "stl3",
        name: "Soil Temperature 3",
        unit: "°C",
        type: "soil_temperature",
        thresholds: {
            low: 10,
            optimalMin: 18,
            optimalMax: 28,
            high: 35
        },
        source: "Demo values"
    },

    temperature: {
        key: "temperature",
        name: "Temperature",
        unit: "°C",
        type: "air_temperature",
        thresholds: {
            low: 15,
            optimalMin: 20,
            optimalMax: 30,
            high: 35
        },
        source: "Demo values"
    },

    humidity: {
        key: "humidity",
        name: "Relative Humidity",
        unit: "%",
        type: "humidity",
        thresholds: {
            low: 40,
            optimalMin: 50,
            optimalMax: 80,
            high: 90
        },
        source: "Demo values"
    },

    wind: {
        key: "wind",
        name: "Wind Speed",
        unit: "km/h",
        type: "wind",
        thresholds: {
            low: 0,
            optimalMin: 0,
            optimalMax: 15,
            high: 25
        },
        source: "Demo values"
    },

    rain: {
        key: "rain",
        name: "Rainfall",
        unit: "mm",
        type: "rainfall",
        thresholds: {
            low: 0,
            optimalMin: 0,
            optimalMax: 10,
            high: 25
        },
        source: "Demo values"
    },

    battery: {
        key: "battery",
        name: "Battery",
        unit: "%",
        type: "device",
        thresholds: {
            low: 20,
            optimalMin: 40,
            optimalMax: 100,
            high: null
        },
        source: "Demo device threshold"
    },

    battery_voltage: {
        key: "battery_voltage",
        name: "Battery Voltage",
        unit: "V",
        type: "device",
        thresholds: {
            low: 3.3,
            optimalMin: 3.6,
            optimalMax: 4.2,
            high: 4.3
        },
        source: "Demo device threshold"
    },

    network_strength: {
        key: "network_strength",
        name: "Network Strength",
        unit: "dBm",
        type: "device",
        thresholds: {
            low: 90,
            optimalMin: 0,
            optimalMax: 70,
            high: null
        },
        source: "Demo device threshold"
    }
};

export function getSensorConfig(sensorKey) {
    return SENSOR_CONFIG[sensorKey] || null;
}

export function getSensorThreshold(sensorKey) {
    return SENSOR_CONFIG[sensorKey]?.thresholds || null;
}