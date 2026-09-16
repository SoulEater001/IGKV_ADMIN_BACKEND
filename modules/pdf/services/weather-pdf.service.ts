import { WeatherPdfRepository } from '../repositories/weather-pdf.repositry.ts';
import { WeatherPdfRendererService } from './weather-pdf-renderer.service.ts'
import { WeatherObservationPdfService } from './weather-observation-pdf.service.ts';
import { WeatherPdfTemplateService } from './weather-pdf-template.service.ts';
import { WeatherForecastPdfService } from './weather-forecast-pdf.service.ts';

import type {
  WeatherAdvisoryPdfOption,
} from '../types/weather-pdf.types.ts';

import { WeatherAdvisoryPdfService } from './weather-advisory-pdf.service.ts';

export class WeatherPdfService {

  private repository: WeatherPdfRepository;
  private renderer: WeatherPdfRendererService;
  private forecastService: WeatherForecastPdfService;
  private observationService: WeatherObservationPdfService;
  private advisoryService: WeatherAdvisoryPdfService;
  private templateService: WeatherPdfTemplateService;

  constructor() {
    this.repository = new WeatherPdfRepository();
    this.renderer = new WeatherPdfRendererService();
    this.templateService = new WeatherPdfTemplateService();
    this.observationService = new WeatherObservationPdfService(this.repository, this.renderer, this.templateService);
    this.forecastService = new WeatherForecastPdfService(this.repository, this.renderer, this.templateService);
    this.advisoryService = new WeatherAdvisoryPdfService(this.repository, this.renderer, this.templateService);
  }

  // Issue date listing
  async getAvailableIssueDates(
    stationId: number,
    reportType: string,
    weatherDataType: string,
    year: number | null,
    month: number | null
  ) {

    const station =
      await this.repository.getStation(stationId);

    if (!station) {
      throw new Error('Weather station not found.');
    }

    if (reportType === 'WEATHER_DATA') {

      if (weatherDataType === 'OBSERVATION') {

        return this.repository.getObservationIssueDates(
          stationId,
          year,
          month
        );
      }

      if (weatherDataType === 'FORECAST') {

        return this.repository.getForecastIssueDates(
          stationId,
          year,
          month
        );
      }

      throw new Error(
        'weatherDataType must be OBSERVATION or FORECAST.'
      );
    }

    if (reportType === 'WEATHER_ADVISORY') {

      return this.repository.getWeatherAdvisoryIssueDates(
        stationId,
        year,
        month
      );
    }

    throw new Error('Invalid reportType.');
  }

  // Forecast report
  async generateDailyWeatherForecastPdf(
    stationId: number,
    reportType: string,
    weatherDataType: string,
    issueDate: string,
    stateLgCode: number,
    fromDate: string,
    toDate: string,
    districtLgCode: number | null,
    blockLgCode: number | null
  ): Promise<Buffer> {

    return this.forecastService.generateDailyWeatherForecastPdf(
      stationId,
      reportType,
      weatherDataType,
      issueDate,
      stateLgCode,
      fromDate,
      toDate,
      districtLgCode,
      blockLgCode
    );
  }

  // Observation
  async generateDailyWeatherPdf(
    stationId: number,
    reportType: string,
    weatherDataType: string,
    issueDate: string,
    fromDate: string,
    toDate: string
  ): Promise<Buffer> {
    return this.observationService.generateDailyWeatherPdf(
      stationId,
      reportType,
      weatherDataType,
      issueDate,
      fromDate,
      toDate
    );
  }

  // Advisory
  async generateWeatherAdvisoryPdf(
    stationId: number,
    reportType: string,
    options: WeatherAdvisoryPdfOption[],
    languageId: number
  ): Promise<Buffer> {

    return this.advisoryService.generateWeatherAdvisoryPdf(
      stationId,
      reportType,
      options,
      languageId
    );
  }
}