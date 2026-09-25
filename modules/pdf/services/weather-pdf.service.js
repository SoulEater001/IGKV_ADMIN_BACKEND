import { WeatherPdfRepository } from "../repositories/weather-pdf.repositry.js";
import { WeatherPdfRendererService } from "./weather-pdf-renderer.service.js";
import { WeatherObservationPdfService } from "./weather-observation-pdf.service.js";
import { WeatherPdfTemplateService } from "./weather-pdf-template.service.js";
import { WeatherForecastPdfService } from "./weather-forecast-pdf.service.js";
import { WeatherAdvisoryPdfService } from "./weather-advisory-pdf.service.js";

export class WeatherPdfService {
    repository;
    renderer;
    forecastService;
    observationService;
    advisoryService;
    templateService;

    constructor() {
        this.repository = new WeatherPdfRepository();
        this.renderer = new WeatherPdfRendererService();
        this.templateService = new WeatherPdfTemplateService();
        this.observationService = new WeatherObservationPdfService(this.repository, this.renderer, this.templateService);
        this.forecastService = new WeatherForecastPdfService(this.repository, this.renderer, this.templateService);
        this.advisoryService = new WeatherAdvisoryPdfService(this.repository, this.renderer, this.templateService);
    }

    // Issue date listing
    async getAvailableIssueDates(stationId, reportType, weatherDataType, year, month) {
        const station = await this.repository.getStation(stationId);

        if (!station) {
            throw new Error('Weather station not found.');
        }

        if (reportType === 'WEATHER_DATA') {
            if (weatherDataType === 'OBSERVATION') {
                return this.repository.getObservationIssueDates(stationId, year, month);
            }
            if (weatherDataType === 'FORECAST') {
                return this.repository.getForecastIssueDates(stationId, year, month);
            }
            throw new Error('weatherDataType must be OBSERVATION or FORECAST.');
        }

        if (reportType === 'WEATHER_ADVISORY') {
            return this.repository.getWeatherAdvisoryIssueDates(stationId, year, month);
        }

        throw new Error('Invalid reportType.');
    }


    // Forecast report
    async generateDailyWeatherForecastPdf(stationId, reportType, weatherDataType, issueDate, stateLgCode, fromDate, toDate, districtLgCode, blockLgCode) {
        return this.forecastService.generateDailyWeatherForecastPdf(stationId, reportType, weatherDataType, issueDate, stateLgCode, fromDate, toDate, districtLgCode, blockLgCode);
    }


    // Observation
    async generateDailyWeatherPdf(stationId, reportType, weatherDataType, issueDate, fromDate, toDate) {
        return this.observationService.generateDailyWeatherPdf(stationId, reportType, weatherDataType, issueDate, fromDate, toDate);
    }


    // Advisory
    async generateWeatherAdvisoryPdf(stationId, reportType, options, languageId) {
        return this.advisoryService.generateWeatherAdvisoryPdf(stationId, reportType, options, languageId);
    }
}
