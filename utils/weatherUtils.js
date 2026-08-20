export const validateObservation = (item) => {

    const ranges = {
        max_temperature: [-5, 50],
        min_temperature: [-10, 40],
        rainfall: [0, 500],
        relative_humidity_1: [0, 100],
        relative_humidity_2: [0, 100],
        vapour_pressure_1: [0, 40],
        vapour_pressure_2: [0, 40],
        wind_speed: [0, 120],
        evaporation: [0, 30],
        sunshine_hours: [0, 14],
    };

    for (const [field, [min, max]] of Object.entries(ranges)) {

        const value = item[field];

        if (value === null || value === undefined) {
            continue;
        }

        if (typeof value !== "number" || !Number.isFinite(value)) {
            return `${field} must be a number`;
        }

        if (value < min || value > max) {
            return `${field} must be between ${min} and ${max}`;
        }
    }

    if (
        item.max_temperature !== null &&
        item.min_temperature !== null &&
        item.min_temperature > item.max_temperature
    ) {
        return "min_temperature cannot exceed max_temperature";
    }

    return null;
};

export const WIND_DIRECTION_OPTIONS = [
    'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW',
];

export const validateForecast = (item) => {

    const ranges = {
        rainfall: [0, 500],
        max_temperature: [-5, 50],
        min_temperature: [-10, 40],
        cloud_amount: [0, 8],
        relative_humidity_1: [0, 100],
        relative_humidity_2: [0, 100],
        wind_speed: [0, 120],
    };

    for (const [field, [min, max]] of Object.entries(ranges)) {

        const value = item[field];

        if (value === null || value === undefined) {
            continue;
        }

        if (typeof value !== "number" || !Number.isFinite(value)) {
            return `${field} must be a number`;
        }

        if (value < min || value > max) {
            return `${field} must be between ${min} and ${max}`;
        }
    }

    if (
        item.wind_direction !== null &&
        item.wind_direction !== undefined
    ) {
        if (
            typeof item.wind_direction !== "string" ||
            !WIND_DIRECTION_OPTIONS.includes(item.wind_direction)
        ) {
            return `wind_direction must be one of ${WIND_DIRECTION_OPTIONS.join(', ')}`;
        }
    }

    if (
        item.max_temperature !== null &&
        item.max_temperature !== undefined &&
        item.min_temperature !== null &&
        item.min_temperature !== undefined &&
        item.min_temperature > item.max_temperature
    ) {
        return "min_temperature cannot exceed max_temperature";
    }

    return null;
};

export const isValidIsoDate = (value) => {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split('-').map(Number);

    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
};

export const formatWeatherValue = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    return Number(value).toString();
};