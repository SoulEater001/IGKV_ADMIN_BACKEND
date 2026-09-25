export const WEATHER_PDF_STATION_CONFIG = [
    {
        stationId: 8,
        stationName: 'Indira Gandhi Krishi Vishwavidyalaya, Krishak Nagar, Raipur',
        stationCode: 'IGKV-RAIPUR',
        stateLgCode: 22,
        districtLgCode: 387,
        blockLgCode: null,
        template: 'igkv'
    },
    {
        stationId: 9,
        stationName: 'Shaheed Gundadhoor College of Agriculture & Research Station, Jagdalpur',
        stationCode: 'SGCARS-JAGDALPUR',
        stateLgCode: 22,
        districtLgCode: 374,
        blockLgCode: null,
        template: 'bastar'
    }
];

export const WEATHER_PDF_TEMPLATE_FILES = {
    'WEATHER_DATA:OBSERVATION': {
        html: 'weather-observation.html',
        css: 'weather-observation.css',
        logo: 'logo.png',
        govLogo: 'govLogo.png'
    },
    'WEATHER_DATA:FORECAST': {
        html: 'weather-forecast.html',
        css: 'weather-forecast.css',
        logo: 'logo.png',
        govLogo: 'govLogo.png'
    },
    'WEATHER_ADVISORY': {
        html: 'weather-advisory.html',
        css: 'weather-advisory.css',
        logo: 'logo.png',
        govLogo: 'govLogo.png'
    }
};

export function resolveWeatherPdfStationTemplate(station) {
    let config = WEATHER_PDF_STATION_CONFIG.find(item => item.stationId === station.id);

    if (config) {
        return config.template;
    }

    config =
        WEATHER_PDF_STATION_CONFIG.find(item => item.stationName === station.station_name);

    if (config) {
        return config.template;
    }

    config =
        WEATHER_PDF_STATION_CONFIG.find(item => item.stationCode !== null &&
            station.station_code !== null &&
            item.stationCode === station.station_code);

    if (config) {
        return config.template;
    }

    config =
        WEATHER_PDF_STATION_CONFIG.find(item => item.stateLgCode === station.state_lg_code &&
            item.districtLgCode === station.district_lg_code &&
            item.blockLgCode === station.block_lg_code);

    return config?.template ?? null;
}

export function resolveWeatherPdfTemplateFiles(reportType, weatherDataType, languageId = 2) {
    const key = reportType === 'WEATHER_DATA'
        ? `${reportType}:${weatherDataType}`
        : reportType;

    const template = WEATHER_PDF_TEMPLATE_FILES[key];

    if (!template) {
        return null;
    }

    if (reportType === 'WEATHER_ADVISORY' && languageId === 1) {
        return {
            ...template,
            html: 'weather-advisory-hi.html',
            css: 'weather-advisory-hi.css'
        };
    }

    return template;
}
