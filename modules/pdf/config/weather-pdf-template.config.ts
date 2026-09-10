export interface WeatherPdfTemplateFiles {
  html: string;
  css: string;
  logo?: string | null;
  govLogo?: string | null;
}

export interface WeatherPdfStationConfig {
  stationId: number;
  stationName: string;
  stationCode: string | null;
  stateLgCode: number;
  districtLgCode: number | null;
  blockLgCode: number | null;
  template: string;
}

export const WEATHER_PDF_STATION_CONFIG: WeatherPdfStationConfig[] = [

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

export const WEATHER_PDF_TEMPLATE_FILES: Record<
  string,
  WeatherPdfTemplateFiles
> = {

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

export function resolveWeatherPdfStationTemplate(
  station: {
    id: number;
    station_name: string;
    station_code: string | null;
    state_lg_code: number;
    district_lg_code: number | null;
    block_lg_code: number | null;
  }
): string | null {

  let config =
    WEATHER_PDF_STATION_CONFIG.find(
      item => item.stationId === station.id
    );

  if (config) {
    return config.template;
  }

  config =
    WEATHER_PDF_STATION_CONFIG.find(
      item => item.stationName === station.station_name
    );

  if (config) {
    return config.template;
  }

  config =
    WEATHER_PDF_STATION_CONFIG.find(
      item =>
        item.stationCode !== null &&
        station.station_code !== null &&
        item.stationCode === station.station_code
    );

  if (config) {
    return config.template;
  }

  config =
    WEATHER_PDF_STATION_CONFIG.find(
      item =>
        item.stateLgCode === station.state_lg_code &&
        item.districtLgCode === station.district_lg_code &&
        item.blockLgCode === station.block_lg_code
    );

  return config?.template ?? null;
}

export function resolveWeatherPdfTemplateFiles(
  reportType: string,
  weatherDataType: string,
  languageId: number = 2
): WeatherPdfTemplateFiles | null {

  const key =
    reportType === 'WEATHER_DATA'
      ? `${reportType}:${weatherDataType}`
      : reportType;

  const template =
    WEATHER_PDF_TEMPLATE_FILES[key];

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