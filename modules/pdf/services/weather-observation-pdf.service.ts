import fs from 'fs/promises';
import path from 'path';

import type { DailyWeatherObservation, DailyWeatherReport } from '../types/weather-pdf.types.ts';
import { WeatherPdfRepository } from '../repositories/weather-pdf.repositry.ts';
import { WeatherPdfRendererService } from './weather-pdf-renderer.service.ts';
import { calculateWeatherMean, calculateWeatherTotal, roundValue, } from '../utils/weather-pdf.utils.ts';
import { displayValue, escapeHtml, formatDate, toNumber } from '../utils/weather-pdf-format.utils.ts';

import { resolveWeatherPdfStationTemplate, resolveWeatherPdfTemplateFiles } from '../config/weather-pdf-template.config.ts';
import { WeatherPdfTemplateService } from './weather-pdf-template.service.ts';

export class WeatherObservationPdfService {

    private repository: WeatherPdfRepository;
    private renderer: WeatherPdfRendererService;
    private templateService: WeatherPdfTemplateService;

    constructor(
        repository: WeatherPdfRepository,
        renderer: WeatherPdfRendererService,
        templateService: WeatherPdfTemplateService
    ) {
        this.repository = repository;
        this.renderer = renderer;
        this.templateService = templateService;
    }

    // Observation report
    async getDailyWeatherReport(
        stationId: number,
        issueDate: string,
        fromDate?: string,
        toDate?: string
    ): Promise<DailyWeatherReport> {

        const station =
            await this.repository.getStation(stationId);

        if (!station) {
            throw new Error('Weather station not found');
        }

        const rows =
            await this.repository.getObservations(
                stationId,
                issueDate,
                fromDate,
                toDate
            );

        const observations: DailyWeatherObservation[] =
            rows.map(row => ({
                observationDate:
                    formatDate(row.observation_date),

                maxTemperature:
                    toNumber(row.max_temperature),

                minTemperature:
                    toNumber(row.min_temperature),

                rainfall:
                    toNumber(row.rainfall),

                relativeHumidity1:
                    toNumber(row.relative_humidity_1),

                relativeHumidity2:
                    toNumber(row.relative_humidity_2),

                vapourPressure1:
                    toNumber(row.vapour_pressure_1),

                vapourPressure2:
                    toNumber(row.vapour_pressure_2),

                windSpeed:
                    toNumber(row.wind_speed),

                evaporation:
                    toNumber(row.evaporation),

                sunshineHours:
                    toNumber(row.sunshine_hours)
            }));

        const rawMean =
            calculateWeatherMean(observations);

        const rawTotal =
            calculateWeatherTotal(observations);

        const mean = {
            maxTemperature:
                roundValue(rawMean.maxTemperature),

            minTemperature:
                roundValue(rawMean.minTemperature),

            relativeHumidity1:
                roundValue(rawMean.relativeHumidity1),

            relativeHumidity2:
                roundValue(rawMean.relativeHumidity2),

            vapourPressure1:
                roundValue(rawMean.vapourPressure1),

            vapourPressure2:
                roundValue(rawMean.vapourPressure2),

            windSpeed:
                roundValue(rawMean.windSpeed),

            sunshineHours:
                roundValue(rawMean.sunshineHours)
        };

        const total = {
            rainfall:
                roundValue(rawTotal.rainfall),

            evaporation:
                roundValue(rawTotal.evaporation)
        };

        const reportDate =
            fromDate ??
            (rows.length > 0
                ? String(rows[0].observation_date).slice(0, 10)
                : issueDate);

        const reportDateObj =
            new Date(`${reportDate}T00:00:00`);

        return {
            station,
            issueDate,

            reportMonth:
                reportDateObj.toLocaleString(
                    'en-US',
                    { month: 'long' }
                ),

            reportYear:
                reportDateObj.getFullYear(),

            observations,
            mean,
            total,
        };
    }

    async generateDailyWeatherPdf(
        stationId: number,
        reportType: string,
        weatherDataType: string,
        issueDate: string,
        fromDate: string,
        toDate: string,
    ): Promise<Buffer> {

        const report =
            await this.getDailyWeatherReport(
                stationId,
                issueDate,
                fromDate,
                toDate
            );

        const html =
            await this.buildHtml(
                report,
                reportType,
                weatherDataType
            );

        return this.renderer.render(html);
    }

    async generateDailyWeatherHtml(
        stationId: number,
        issueDate: string,
        fromDate: string,
        toDate: string
    ): Promise<string> {

        const report =
            await this.getDailyWeatherReport(
                stationId,
                issueDate,
                fromDate,
                toDate
            );

        return this.buildHtml(
            report,
            'WEATHER_DATA',
            'OBSERVATION'
        );
    }

    private async buildHtml(
        report: DailyWeatherReport,
        reportType: string,
        weatherDataType: string
    ): Promise<string> {

        const template = await this.templateService.loadTemplate(
            reportType,
            weatherDataType,
            report.station
        );

        let logo = template.logo;
        let govLogo = template.govLogo;

        let html = template.html;

        const css = template.css;

        const observationRows =
            report.observations
                .map(observation => `
      <tr>
        <td>${escapeHtml(observation.observationDate)}</td>
        <td>${displayValue(observation.maxTemperature)}</td>
        <td>${displayValue(observation.minTemperature)}</td>
        <td>${displayValue(observation.rainfall)}</td>
        <td>${displayValue(observation.relativeHumidity1)}</td>
        <td>${displayValue(observation.relativeHumidity2)}</td>
        <td>${displayValue(observation.vapourPressure1)}</td>
        <td>${displayValue(observation.vapourPressure2)}</td>
        <td>${displayValue(observation.windSpeed)}</td>
        <td>${displayValue(observation.evaporation)}</td>
        <td>${displayValue(observation.sunshineHours)}</td>
      </tr>
    `)
                .join('');

        const meanRow = `
    <tr class="summary-row">
        <td>Mean</td>
        <td>${displayValue(report.mean.maxTemperature)}</td>
        <td>${displayValue(report.mean.minTemperature)}</td>
        <td></td>
        <td>${displayValue(report.mean.relativeHumidity1)}</td>
        <td>${displayValue(report.mean.relativeHumidity2)}</td>
        <td>${displayValue(report.mean.vapourPressure1)}</td>
        <td>${displayValue(report.mean.vapourPressure2)}</td>
        <td>${displayValue(report.mean.windSpeed)}</td>
        <td></td>
        <td>${displayValue(report.mean.sunshineHours)}</td>
    </tr>
`;

        const totalRow = `
    <tr class="summary-row">
        <td>Total</td>
        <td></td>
        <td></td>
        <td>${displayValue(report.total.rainfall)}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td>${displayValue(report.total.evaporation)}</td>
        <td></td>
    </tr>
`;


        html = html
            .replace('/*WEATHER_PDF_CSS*/', css)
            .replace('{{logo}}', logo)
            .replace('{{leftLogo}}', logo)
            .replace('{{govtLogo}}', govLogo)
            .replace('{{reportMonth}}', escapeHtml(report.reportMonth))
            .replace('{{reportYear}}', String(report.reportYear))
            // .replace('{{bulletinNo}}', bulletinNo != null ? String(bulletinNo) : '')
            // .replace('{{issueDate}}', escapeHtml(report.issueDate))
            .replace('{{observationRows}}', observationRows)
            .replace('{{meanRow}}', meanRow)
            .replace('{{totalRow}}', totalRow);

        return html;
    }
}