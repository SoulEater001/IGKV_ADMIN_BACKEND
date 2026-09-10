export interface WeatherAdvisoryPdfOption {
  issueDate: string;
  stateLgCode: number;
  districtLgCode: number | null;
  blockLgCode: number | null;
}

export interface DailyWeatherObservation {
  observationDate: string;
  maxTemperature: number | null;
  minTemperature: number | null;
  rainfall: number | null;
  relativeHumidity1: number | null;
  relativeHumidity2: number | null;
  vapourPressure1: number | null;
  vapourPressure2: number | null;
  windSpeed: number | null;
  evaporation: number | null;
  sunshineHours: number | null;
}

export interface DailyWeatherMean {
  maxTemperature: number | null;
  minTemperature: number | null;
  relativeHumidity1: number | null;
  relativeHumidity2: number | null;
  vapourPressure1: number | null;
  vapourPressure2: number | null;
  windSpeed: number | null;
  sunshineHours: number | null;
}

export interface DailyWeatherTotal {
  rainfall: number | null;
  evaporation: number | null;
}

export interface DailyWeatherForecast {
  forecastDate: string;
  rainfall: number | null;
  maxTemperature: number | null;
  minTemperature: number | null;
  cloudAmount: number | null;
  relativeHumidity1: number | null;
  relativeHumidity2: number | null;
  windSpeed: number | null;
  windDirection: string | null;
}

export interface WeatherPdfReportContext {
  station: WeatherPdfStationContext;
  issueDate: string;
  reportMonth: string;
  reportYear: number;
}

export interface WeatherPdfLocationContext {
  stateLgCode: number;
  stateNameEn: string | null;
  stateNameHi: string | null;

  districtLgCode: number | null;
  districtNameEn: string | null;
  districtNameHi: string | null;

  blockLgCode: number | null;
  blockNameEn: string | null;
  blockNameHi: string | null;
}

export interface WeatherPdfStationContext {
  id: number;
  station_name: string;
  station_code: string | null;
  state_lg_code: number;
  district_lg_code: number | null;
  block_lg_code: number | null;
}

export interface DailyWeatherReport extends WeatherPdfReportContext {
  observations: DailyWeatherObservation[];
  mean: DailyWeatherMean;
  total: DailyWeatherTotal;
}

export interface DailyWeatherForecastReport extends WeatherPdfReportContext, WeatherPdfLocationContext {
  forecasts: DailyWeatherForecast[];
}

export interface WeatherAdvisoryDetail {
  advisoryDetailId: number | null;

  categoryId: number | null;
  categoryName: string | null;

  cropId: number | null;
  cropName: string | null;

  cropStageId: number | null;
  cropStageName: string | null;

  advisoryTypeId: number | null;
  advisoryTypeName: string | null;
  advisory: string | null;
}

export interface WeatherAdvisoryReport
  extends WeatherPdfReportContext,
  WeatherPdfLocationContext {

  observationFromDate: string | null;
  observationEndDate: string | null;

  forecastFromDate: string | null;
  forecastEndDate: string | null;

  observations: DailyWeatherObservation[];
  observationMean: DailyWeatherMean;
  observationTotal: DailyWeatherTotal;

  forecasts: DailyWeatherForecast[];

  observationSummaryEn: string | null;
  observationSummaryHi: string | null;
  forecastSummaryEn: string | null;
  forecastSummaryHi: string | null;

  advisories: WeatherAdvisoryDetail[];
}