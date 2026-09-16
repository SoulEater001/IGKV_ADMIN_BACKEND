import fs from 'fs/promises';
import path from 'path';

import { escapeHtml, displayValue, toNumber, formatDate, formatRange, getMinMax } from '../utils/weather-pdf-format.utils.ts';

import type { DailyWeatherForecast, DailyWeatherMean, DailyWeatherObservation, DailyWeatherTotal, WeatherAdvisoryDetail, WeatherAdvisoryPdfOption, WeatherAdvisoryReport } from '../types/weather-pdf.types.ts';
import { calculateWeatherMean, calculateWeatherTotal, roundValue } from '../utils/weather-pdf.utils.ts';
import { resolveWeatherPdfTemplateFiles } from '../config/weather-pdf-template.config.ts';
import { WeatherPdfRepository } from '../repositories/weather-pdf.repositry.ts';
import { WeatherPdfRendererService } from './weather-pdf-renderer.service.ts';
import { WeatherPdfTemplateService } from './weather-pdf-template.service.ts';


export class WeatherAdvisoryPdfService {

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

    async getWeatherAdvisoryReport(
        stationId: number,
        issueDate: string,
        stateLgCode: number,
        districtLgCode: number | null = null,
        blockLgCode: number | null = null,
        languageId: number
    ): Promise<WeatherAdvisoryReport> {

        const station =
            await this.repository.getStation(stationId);

        if (!station) {
            throw new Error('Weather station not found');
        }

        const [
            observationRows,
            observationSummary,
            forecastRows,
            forecastSummary,
            advisories,
            location
        ] = await Promise.all([
            this.repository.getAdvisoryObservations(
                stationId,
                issueDate
            ),

            this.repository.getObservationSummary(
                stationId,
                issueDate
            ),

            this.repository.getForecasts(
                stationId,
                issueDate,
                stateLgCode,
                undefined,
                undefined,
                districtLgCode,
                blockLgCode
            ),

            this.repository.getForecastSummary(
                issueDate,
                stateLgCode,
                districtLgCode,
                blockLgCode
            ),

            this.repository.getAdvisories(
                issueDate,
                stateLgCode,
                districtLgCode,
                blockLgCode,
                languageId
            ),

            this.repository.getLocationNames(
                stateLgCode,
                districtLgCode,
                blockLgCode
            )
        ]);

        const observations: DailyWeatherObservation[] =
            observationRows.map(row => ({
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

        const forecasts: DailyWeatherForecast[] =
            forecastRows.map(row => ({
                forecastDate:
                    formatDate(row.forecast_date, languageId),

                rainfall:
                    toNumber(row.rainfall),

                maxTemperature:
                    toNumber(row.max_temperature),

                minTemperature:
                    toNumber(row.min_temperature),

                cloudAmount:
                    toNumber(row.cloud_amount),

                relativeHumidity1:
                    toNumber(row.relative_humidity_1),

                relativeHumidity2:
                    toNumber(row.relative_humidity_2),

                windSpeed:
                    toNumber(row.wind_speed),

                windDirection:
                    row.wind_direction ?? null
            }));

        const rawMean =
            calculateWeatherMean(observations);

        const rawTotal =
            calculateWeatherTotal(observations);

        const observationMean: DailyWeatherMean = {
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

        const observationTotal: DailyWeatherTotal = {
            rainfall:
                roundValue(rawTotal.rainfall),

            evaporation:
                roundValue(rawTotal.evaporation)
        };

        const observationFromDate =
            observationRows.length > 0
                ? formatDate(observationRows[0].observation_date, languageId)
                : null;

        const observationEndDate =
            observationRows.length > 0
                ? formatDate(
                    observationRows[observationRows.length - 1].observation_date,
                    languageId
                )
                : null;

        const forecastFromDate =
            forecastRows.length > 0
                ? formatDate(forecastRows[0].forecast_date, languageId)
                : null;

        const forecastEndDate =
            forecastRows.length > 0
                ? formatDate(
                    forecastRows[forecastRows.length - 1].forecast_date,
                    languageId
                )
                : null;

        const reportDate =
            observationRows.length > 0
                ? String(observationRows[0].observation_date).slice(0, 10)
                : forecastRows.length > 0
                    ? String(forecastRows[0].forecast_date).slice(0, 10)
                    : issueDate;

        const reportDateObj =
            new Date(`${reportDate}T00:00:00`);

        const advisoryDetails: WeatherAdvisoryDetail[] =
            advisories.map(row => ({
                advisoryDetailId: row.advisory_detail_id ?? null,

                categoryId: row.cat_id ?? null,
                categoryName: row.category_name ?? null,

                cropId: row.crop_id ?? null,
                cropName: row.crop_name ?? null,

                cropStageId: row.crop_stage_id ?? null,
                cropStageName: row.crop_stage_name ?? null,

                advisoryTypeId: row.advisory_type_id ?? null,
                advisoryTypeName: row.advisory_type_name ?? null,

                advisory: row.advisory ?? null
            }));

        return {
            station,

            stateLgCode,

            stateNameEn:
                location?.state_name_en ?? null,

            stateNameHi:
                location?.state_name_hi ?? null,

            districtLgCode,

            districtNameEn:
                location?.district_name_en ?? null,

            districtNameHi:
                location?.district_name_hi ?? null,

            blockLgCode,

            blockNameEn:
                location?.block_name_en ?? null,

            blockNameHi:
                location?.block_name_hi ?? null,

            issueDate,

            reportMonth:
                reportDateObj.toLocaleString(
                    'en-US',
                    { month: 'long' }
                ),

            reportYear:
                reportDateObj.getFullYear(),

            observationFromDate,
            observationEndDate,

            forecastFromDate,
            forecastEndDate,

            observations,

            observationMean,

            observationTotal,

            forecasts,

            observationSummaryEn:
                observationSummary?.summary_en ?? null,

            observationSummaryHi:
                observationSummary?.summary_hi ?? null,

            forecastSummaryEn:
                forecastSummary?.summary_en ?? null,

            forecastSummaryHi:
                forecastSummary?.summary_hi ?? null,

            advisories: advisoryDetails
        };
    }

    async generateWeatherAdvisoryPdf(
        stationId: number,
        reportType: string,
        options: WeatherAdvisoryPdfOption[],
        languageId: number
    ): Promise<Buffer> {

        const reports =
            await Promise.all(
                options.map(option =>
                    this.getWeatherAdvisoryReport(
                        stationId,
                        option.issueDate,
                        option.stateLgCode,
                        option.districtLgCode,
                        option.blockLgCode,
                        languageId
                    )
                )
            );

        const html =
            await this.buildWeatherAdvisoryHtml(
                reports,
                reportType,
                'ADVISORY',
                languageId
            );

        return this.renderer.render(html);
    }

    private async buildWeatherAdvisoryHtml(
        reports: WeatherAdvisoryReport[],
        reportType: string,
        weatherDataType: string,
        languageId: number
    ): Promise<string> {

        if (reports.length === 0) {
            throw new Error(
                'No weather advisory reports available.'
            );
        }

        const firstReport =
            reports[0];

        const template =
            await this.templateService.loadTemplate(
                reportType,
                weatherDataType,
                firstReport.station,
                languageId
            );


        const logo = template.logo;
        const govLogo = template.govLogo;
        const css = template.css;

        const reportBodies: string[] = [];

        for (const report of reports) {

            let html = template.html;

            // ============================================================
            // OBSERVATIONS
            // ============================================================

            const rainfall =
                getMinMax(
                    report.observations.map(
                        observation => observation.rainfall
                    )
                );

            const maxTemperature =
                getMinMax(
                    report.observations.map(
                        observation => observation.maxTemperature
                    )
                );

            const minTemperature =
                getMinMax(
                    report.observations.map(
                        observation => observation.minTemperature
                    )
                );

            const morningHumidity =
                getMinMax(
                    report.observations.map(
                        observation => observation.relativeHumidity1
                    )
                );

            const afternoonHumidity =
                getMinMax(
                    report.observations.map(
                        observation => observation.relativeHumidity2
                    )
                );

            const windSpeed =
                getMinMax(
                    report.observations.map(
                        observation => observation.windSpeed
                    )
                );

            const observationSummaryLabels =
                languageId === 1
                    ? {
                        rainfall: 'वर्षा (मिमी)',
                        maxTemperature: 'अधिकतम तापमान (°C)',
                        minTemperature: 'न्यूनतम तापमान (°C)',
                        relativeHumidity: 'सापेक्ष आर्द्रता (%)',
                        morning: 'प्रातः:-',
                        afternoon: 'दोपहर:-',
                        windSpeed: 'हवा की गति (किमी/घंटा)'
                    }
                    : {
                        rainfall: 'Rainfall (mm)',
                        maxTemperature: 'Maximum Temperature (°C)',
                        minTemperature: 'Minimum Temperature (°C)',
                        relativeHumidity: 'Relative humidity (%)',
                        morning: 'Morning:-',
                        afternoon: 'Afternoon:-',
                        windSpeed: 'Wind speed (kmph)'
                    };

            const observationSummaryTable = `
    <table class="observation-summary-table">
    
      <tbody>
    
        <tr>
          <td class="observation-summary-label">
            ${observationSummaryLabels.rainfall}
          </td>
    
          <td class="observation-summary-value">
            ${formatRange(
                rainfall.min,
                rainfall.max
            )}
          </td>
        </tr>
    
        <tr>
          <td class="observation-summary-label">
            ${observationSummaryLabels.maxTemperature}
          </td>
    
          <td class="observation-summary-value">
            ${formatRange(
                maxTemperature.min,
                maxTemperature.max
            )}
          </td>
        </tr>
    
        <tr>
          <td class="observation-summary-label">
            ${observationSummaryLabels.minTemperature}
          </td>
    
          <td class="observation-summary-value">
            ${formatRange(
                minTemperature.min,
                minTemperature.max
            )}
          </td>
        </tr>
    
        <tr>
          <td class="observation-summary-label humidity-main-label">
            <div>
              ${observationSummaryLabels.relativeHumidity}
              <span class="humidity-inline-label">
                ${observationSummaryLabels.morning}
              </span>
            </div>
    
            <div class="humidity-afternoon">
              ${observationSummaryLabels.afternoon}
            </div>
          </td>
    
          <td class="observation-summary-value humidity-value">
            <div>
              ${formatRange(
                morningHumidity.min,
                morningHumidity.max
            )}
            </div>
    
            <div>
              ${formatRange(
                afternoonHumidity.min,
                afternoonHumidity.max
            )}
            </div>
          </td>
        </tr>
    
        <tr>
          <td class="observation-summary-label">
            ${observationSummaryLabels.windSpeed}
          </td>
    
          <td class="observation-summary-value">
            ${formatRange(
                windSpeed.min,
                windSpeed.max
            )}
          </td>
        </tr>
    
      </tbody>
    
    </table>
    `;

            // ============================================================
            // FORECASTS
            // ============================================================

            const forecastRows =
                report.forecasts
                    .map(forecast => `
        <tr>
          <td>${escapeHtml(forecast.forecastDate)}</td>
          <td>${displayValue(forecast.rainfall)}</td>
          <td>${displayValue(forecast.maxTemperature)}</td>
          <td>${displayValue(forecast.minTemperature)}</td>
          <td>${displayValue(forecast.cloudAmount)}</td>
          <td>${displayValue(forecast.relativeHumidity1)}</td>
          <td>${displayValue(forecast.relativeHumidity2)}</td>
          <td>${displayValue(forecast.windSpeed)}</td>
          <td>${escapeHtml(forecast.windDirection ?? '')}</td>
        </tr>
      `)
                    .join('');

            // ============================================================
            // SUMMARY
            // ============================================================

            const observationSummary =
                languageId === 1
                    ? report.observationSummaryHi
                    : report.observationSummaryEn;

            const forecastSummary =
                languageId === 1
                    ? report.forecastSummaryHi
                    : report.forecastSummaryEn;

            const observationSummaryLabel =
                languageId === 1
                    ? 'अवलोकन सारांश:'
                    : 'Observation Summary:';

            const forecastSummaryLabel =
                languageId === 1
                    ? 'पूर्वानुमान सारांश:'
                    : 'Forecast Summary:';

            const observationSummarySection =
                observationSummary
                    ? `
    <div class="weather-summary">
      <p>
        <strong>${observationSummaryLabel}</strong>
        ${this.formatWeatherSummary(observationSummary)}
      </p>
    </div>
    `
                    : '';

            const forecastSummarySection =
                forecastSummary
                    ? `
    <div class="weather-summary">
      <p>
        <strong>${forecastSummaryLabel}</strong>
        ${this.formatWeatherSummary(forecastSummary)}
      </p>
    </div>
    `
                    : '';

            // ============================================================
            // ADVISORY CLASSIFICATION
            // ============================================================

            const animalHusbandryPoultryAdvisories =
                report.advisories.filter(
                    advisory =>
                        this.isAnimalHusbandryCategory(
                            advisory.categoryName
                        )
                );

            const fruitVegetableAdvisories =
                report.advisories.filter(
                    advisory =>
                        this.isFruitVegetableCategory(
                            advisory.categoryName
                        )
                );

            const cropAdvisories =
                report.advisories.filter(
                    advisory =>
                        advisory.cropName &&
                        advisory.cropStageName &&
                        !this.isAnimalHusbandryCategory(
                            advisory.categoryName
                        ) &&
                        !this.isFruitVegetableCategory(
                            advisory.categoryName
                        )
                );

            const typeOnlyAdvisories =
                report.advisories.filter(
                    advisory =>
                        !advisory.cropName &&
                        !advisory.cropStageName &&
                        !this.isAnimalHusbandryCategory(
                            advisory.categoryName
                        ) &&
                        !this.isFruitVegetableCategory(
                            advisory.categoryName
                        )
                );

            // ============================================================
            // CROP BASED ADVISORIES
            // ============================================================

            const advisoryGroups = new Map<
                string,
                {
                    cropName: string;
                    cropStageName: string;
                    agriculturalActivities: string[];
                    weatherBasedAdvisories: string[];
                }
            >();

            for (const advisory of cropAdvisories) {

                const cropName =
                    advisory.cropName ?? '';

                const cropStageName =
                    advisory.cropStageName ?? '';

                const key =
                    `${cropName}|||${cropStageName}`;

                if (!advisoryGroups.has(key)) {
                    advisoryGroups.set(key, {
                        cropName,
                        cropStageName,
                        agriculturalActivities: [],
                        weatherBasedAdvisories: []
                    });
                }

                const group =
                    advisoryGroups.get(key)!;

                if (
                    this.isAgriculturalActivity(
                        advisory.advisoryTypeName
                    )
                ) {

                    if (advisory.advisory) {
                        group.agriculturalActivities.push(
                            advisory.advisory
                        );
                    }

                } else if (
                    this.isWeatherBasedAdvisory(
                        advisory.advisoryTypeName
                    )
                ) {

                    if (advisory.advisory) {
                        group.weatherBasedAdvisories.push(
                            advisory.advisory
                        );
                    }
                }
            }

            const advisoryRows =
                Array.from(advisoryGroups.values())
                    .map(group => {

                        const agriculturalActivities =
                            group.agriculturalActivities
                                .map(advisory =>
                                    this.formatAdvisoryText(
                                        advisory,
                                        languageId
                                    )
                                )
                                .join('');

                        const weatherBasedAdvisories =
                            group.weatherBasedAdvisories
                                .map(advisory =>
                                    this.formatAdvisoryText(
                                        advisory,
                                        languageId
                                    )
                                )
                                .join('');

                        return `
    <tr>
      <td class="advisory-crop">
        ${escapeHtml(group.cropName)}
      </td>
    
      <td class="advisory-crop-stage">
        ${escapeHtml(group.cropStageName)}
      </td>
    
      <td class="advisory-text">
        ${agriculturalActivities}
      </td>
    
      <td class="advisory-text">
        ${weatherBasedAdvisories}
      </td>
    </tr>
    `;
                    })
                    .join('');

            // ============================================================
            // TYPE BASED ADVISORIES
            // ============================================================

            const getTypeAdvisories =
                (
                    typeMatcher: (
                        typeName: string | null
                    ) => boolean
                ): WeatherAdvisoryDetail[] => {

                    return typeOnlyAdvisories.filter(
                        advisory =>
                            typeMatcher(
                                advisory.advisoryTypeName
                            ) &&
                            !!advisory.advisory
                    );
                };

            const buildTypeSection =
                (
                    typeMatcher: (
                        typeName: string | null
                    ) => boolean
                ): string => {

                    const advisories =
                        getTypeAdvisories(typeMatcher);

                    if (advisories.length === 0) {
                        return '';
                    }

                    return advisories
                        .map(advisory =>
                            this.formatAdvisoryText(
                                advisory.advisory,
                                languageId
                            )
                        )
                        .join('');
                };

            const generalAdvisorySection =
                buildTypeSection(
                    typeName => {
                        if (!typeName) {
                            return false;
                        }

                        const type =
                            typeName
                                .trim()
                                .toLowerCase();

                        return (
                            type.includes('general') ||
                            type.includes('सामान्य')
                        );
                    }
                );

            const messageAdvisorySection =
                buildTypeSection(
                    typeName => {
                        if (!typeName) {
                            return false;
                        }

                        const type =
                            typeName
                                .trim()
                                .toLowerCase();

                        return (
                            type.includes('message') ||
                            type.includes('संदेश')
                        );
                    }
                );

            const weatherWarningImpactSection =
                buildTypeSection(
                    typeName => {
                        if (!typeName) {
                            return false;
                        }

                        const type =
                            typeName
                                .trim()
                                .toLowerCase();

                        return (
                            (
                                type.includes('weather') &&
                                type.includes('warning') &&
                                type.includes('impact')
                            ) ||
                            type.includes('मौसम चेतावनी प्रभाव')
                        );
                    }
                );

            const agrometAdvisorySection =
                buildTypeSection(
                    typeName => {
                        if (!typeName) {
                            return false;
                        }

                        const type =
                            typeName
                                .trim()
                                .toLowerCase();

                        return (
                            type.includes('agromet') ||
                            type.includes('कृषि मौसम')
                        );
                    }
                );

            const generalAdvisorySectionClass =
                generalAdvisorySection ? '' : 'hidden';

            const messageAdvisorySectionClass =
                messageAdvisorySection ? '' : 'hidden';

            const weatherWarningImpactSectionClass =
                weatherWarningImpactSection ? '' : 'hidden';

            const agrometAdvisorySectionClass =
                agrometAdvisorySection ? '' : 'hidden';

            // ============================================================
            // ANIMAL HUSBANDRY / POULTRY
            // ============================================================

            const animalHusbandryPoultryContent =
                animalHusbandryPoultryAdvisories
                    .filter(advisory => !!advisory.advisory)
                    .map(advisory =>
                        this.formatAdvisoryText(
                            advisory.advisory,
                            languageId
                        )
                    )
                    .join('');

            const animalHusbandryPoultrySection =
                animalHusbandryPoultryContent || '';

            const animalHusbandryPoultrySectionClass =
                animalHusbandryPoultryContent
                    ? ''
                    : 'hidden';

            // ============================================================
            // FRUIT & VEGETABLE CROPS
            // ============================================================

            const fruitVegetableContent =
                fruitVegetableAdvisories
                    .filter(advisory => !!advisory.advisory)
                    .map(advisory =>
                        this.formatAdvisoryText(
                            advisory.advisory,
                            languageId
                        )
                    )
                    .join('');

            const fruitVegetableSection =
                fruitVegetableContent || '';

            const fruitVegetableSectionClass =
                fruitVegetableContent
                    ? ''
                    : 'hidden';

            // ============================================================
            // DATE RANGES
            // ============================================================

            const dateRangeSeparator =
                languageId === 1
                    ? ' से '
                    : ' to ';

            const observationDateRange =
                report.observationFromDate &&
                    report.observationEndDate
                    ? `${escapeHtml(report.observationFromDate)}${dateRangeSeparator}${escapeHtml(report.observationEndDate)}`
                    : '';

            const forecastDateRange =
                report.forecastFromDate &&
                    report.forecastEndDate
                    ? `${escapeHtml(report.forecastFromDate)}${dateRangeSeparator}${escapeHtml(report.forecastEndDate)}`
                    : '';

            // ============================================================
            // WEATHER SECTION HEADINGS
            // ============================================================

            const observationHeading =
                report.observationFromDate &&
                    report.observationEndDate
                    ? languageId === 1
                        ? `दिनांक ${escapeHtml(report.observationFromDate)} से ${escapeHtml(report.observationEndDate)} तक कृषि-मौसम विज्ञान वेधशाला, <div>SGCARS, जगदलपुर में दर्ज मौसम</div>`
                        : `Weather recorded from ${escapeHtml(report.observationFromDate)} to ${escapeHtml(report.observationEndDate)} at Agromet-Observatory, <div>SGCARS, Jagdalpur</div>`
                    : languageId === 1
                        ? 'मौसम अवलोकन'
                        : 'Weather Observation';

            const forecastHeading =
                report.forecastFromDate &&
                    report.forecastEndDate
                    ? languageId === 1
                        ? `
            <div>मध्यम अवधि मौसम पूर्वानुमान</div>
            <div>
              बस्तर पठार क्षेत्र के लिए कृषि सलाह सेवाएं बुलेटिन
              (${escapeHtml(report.forecastFromDate)} से ${escapeHtml(report.forecastEndDate)} तक)
              <div>
                जिला-${escapeHtml(report.districtNameHi ?? '')} का मौसम पूर्वानुमान
              </div>
            </div>
          `
                        : `
            <div>Medium Range Weather Forecast</div>
            <div>
              Agro Advisory services bulletin for Bastar Plateau Zone
              (${escapeHtml(report.forecastFromDate)} to ${escapeHtml(report.forecastEndDate)})
              <div>
                weather forecast of District-${escapeHtml(report.districtNameEn ?? '')}
              </div>
            </div>
          `
                    : languageId === 1
                        ? 'मध्यम अवधि मौसम पूर्वानुमान'
                        : 'Medium Range Weather Forecast';

            // ============================================================
            // BLOCK HEADING
            // ============================================================

            const blockHeading =
                report.blockLgCode
                    ? languageId === 1
                        ? report.blockNameHi
                            ? `<div class="block-heading">ब्लॉक - ${escapeHtml(report.blockNameHi)}</div>`
                            : ''
                        : report.blockNameEn
                            ? `<div class="block-heading">Block - ${escapeHtml(report.blockNameEn)}</div>`
                            : ''
                    : '';

            // ============================================================
            // TEMPLATE REPLACEMENT
            // ============================================================

            html = html
                .replace('/*WEATHER_PDF_CSS*/', css)
                .replace('{{logo}}', logo)
                .replace('{{leftLogo}}', logo)
                .replace('{{govtLogo}}', govLogo)

                .replace(
                    '{{reportMonth}}',
                    escapeHtml(report.reportMonth)
                )

                .replace(
                    '{{reportYear}}',
                    String(report.reportYear)
                )

                .replace(
                    '{{issueDate}}',
                    escapeHtml(report.issueDate)
                )

                .replace(
                    '{{stateNameEn}}',
                    escapeHtml(
                        report.stateNameEn ?? ''
                    )
                )

                .replace(
                    '{{stateNameHi}}',
                    escapeHtml(
                        report.stateNameHi ?? ''
                    )
                )

                .replace(
                    '{{observationHeading}}',
                    observationHeading
                )

                .replace(
                    '{{forecastHeading}}',
                    forecastHeading
                )

                .replace(
                    '{{districtNameEn}}',
                    escapeHtml(
                        report.districtNameEn ?? ''
                    )
                )

                .replace(
                    '{{districtNameHi}}',
                    escapeHtml(
                        report.districtNameHi ?? ''
                    )
                )

                .replace(
                    '{{blockHeading}}',
                    blockHeading
                )

                .replace(
                    '{{observationFromDate}}',
                    escapeHtml(
                        report.observationFromDate ?? ''
                    )
                )

                .replace(
                    '{{observationEndDate}}',
                    escapeHtml(
                        report.observationEndDate ?? ''
                    )
                )

                .replace(
                    '{{observationDateRange}}',
                    observationDateRange
                )

                .replace(
                    '{{forecastFromDate}}',
                    escapeHtml(
                        report.forecastFromDate ?? ''
                    )
                )

                .replace(
                    '{{forecastEndDate}}',
                    escapeHtml(
                        report.forecastEndDate ?? ''
                    )
                )

                .replace(
                    '{{forecastDateRange}}',
                    forecastDateRange
                )

                .replace(
                    '{{observationSummaryTable}}',
                    observationSummaryTable
                )

                .replace(
                    '{{observationSummarySection}}',
                    observationSummarySection
                )

                .replace(
                    '{{forecastRows}}',
                    forecastRows
                )

                .replace(
                    '{{forecastSummarySection}}',
                    forecastSummarySection
                )

                .replace(
                    '{{advisoryRows}}',
                    advisoryRows
                )

                .replace(
                    '{{generalAdvisorySectionClass}}',
                    generalAdvisorySectionClass
                )

                .replace(
                    '{{messageAdvisorySectionClass}}',
                    messageAdvisorySectionClass
                )

                .replace(
                    '{{weatherWarningImpactSectionClass}}',
                    weatherWarningImpactSectionClass
                )

                .replace(
                    '{{agrometAdvisorySectionClass}}',
                    agrometAdvisorySectionClass
                )

                .replace(
                    '{{animalHusbandryPoultrySectionClass}}',
                    animalHusbandryPoultrySectionClass
                )

                .replace(
                    '{{fruitVegetableSectionClass}}',
                    fruitVegetableSectionClass
                )

                .replace(
                    '{{generalAdvisorySection}}',
                    generalAdvisorySection
                )

                .replace(
                    '{{messageAdvisorySection}}',
                    messageAdvisorySection
                )

                .replace(
                    '{{weatherWarningImpactSection}}',
                    weatherWarningImpactSection
                )

                .replace(
                    '{{agrometAdvisorySection}}',
                    agrometAdvisorySection
                )

                .replace(
                    '{{animalHusbandryPoultrySection}}',
                    animalHusbandryPoultrySection
                )

                .replace(
                    '{{fruitVegetableSection}}',
                    fruitVegetableSection
                );

            // ============================================================
            // EXTRACT BODY
            // ============================================================

            const bodyMatch =
                html.match(
                    /<body[^>]*>([\s\S]*?)<\/body>/i
                );

            if (!bodyMatch) {
                throw new Error(
                    'Weather advisory PDF template does not contain a <body> element.'
                );
            }

            reportBodies.push(
                bodyMatch[1]
            );
        }

        // ============================================================
        // COMBINE REPORTS
        // ============================================================

        const combinedBody =
            reportBodies
                .map(
                    (body, index) => `
    <div class="weather-advisory-report${index > 0 ? ' page-break' : ''}">
      ${body}
    </div>
    `
                )
                .join('\n');

        // Use the original template only for document structure.
        let finalHtml =
            template.html.replace(
                /<body[^>]*>[\s\S]*?<\/body>/i,
                `<body>${combinedBody}</body>`
            );

        finalHtml =
            finalHtml.replace(
                '/*WEATHER_PDF_CSS*/',
                css
            );

        return finalHtml;
    }

    private isAnimalHusbandryCategory(
        categoryName: string | null
    ): boolean {
        if (!categoryName) {
            return false;
        }

        const category =
            categoryName
                .trim()
                .toLowerCase()
                .replace(/&/g, 'and');

        return (
            (
                category.includes('animal') &&
                category.includes('husbandry') &&
                category.includes('poultry')
            ) ||
            (
                category.includes('पशुपालन') &&
                category.includes('कुक्कुट')
            )
        );
    }

    private isFruitVegetableCategory(
        categoryName: string | null
    ): boolean {
        if (!categoryName) {
            return false;
        }

        const category =
            categoryName
                .trim()
                .toLowerCase()
                .replace(/&/g, 'and');

        return (
            (
                category.includes('fruit') &&
                category.includes('vegetable')
            ) ||
            (
                category.includes('फल') &&
                category.includes('सब्जी')
            )
        );
    }

    private isAgriculturalActivity(
        advisoryTypeName: string | null
    ): boolean {
        if (!advisoryTypeName) {
            return false;
        }

        const type =
            advisoryTypeName
                .trim()
                .toLowerCase();

        return (
            type.includes('agricultural') &&
            type.includes('activit')
        ) ||
            type.includes('कृषि गतिविध');
    }

    private isWeatherBasedAdvisory(
        advisoryTypeName: string | null
    ): boolean {
        if (!advisoryTypeName) {
            return false;
        }

        const type =
            advisoryTypeName
                .trim()
                .toLowerCase();

        return (
            (
                type.includes('weather') &&
                type.includes('based')
            ) ||
            type.includes('मौसम आधारित')
        );
    }

    private formatAdvisoryText(
        advisory: string | null,
        languageId: number = 2
    ): string {

        if (!advisory) {
            return '';
        }

        const sentenceRegex =
            languageId === 1
                ? /[^।]+।|[^।]+$/g
                : /[^.]+\.|[^.]+$/g;

        const sentences =
            advisory
                .match(sentenceRegex)
                ?.map(sentence => sentence.trim())
                .filter(sentence => sentence.length > 0) ?? [];


        if (sentences.length === 0) {
            return '';
        }

        return `
        <ul class="advisory-list">
          ${sentences
                .map(sentence => `
              <li>
                ${escapeHtml(sentence)}
              </li>
            `)
                .join('')}
        </ul>
      `;
    }

    private formatWeatherSummary(
        summary: string | null
    ): string {

        if (!summary) {
            return '';
        }

        let text = escapeHtml(summary);

        // Convert temperature ranges such as:
        // 27.7-33.00C
        // 21.5-23.00C
        // 27.7 - 33.00°C
        // into highlighted values on both sides.
        text = text.replace(
            /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:°?\s*C)\b/gi,
            '<strong>$1°C</strong> - <strong>$2°C</strong>'
        );

        // Highlight standalone temperatures such as:
        // 33.0°C
        // 23°C
        // 33.00C
        text = text.replace(
            /(\d+(?:\.\d+)?)\s*(?:°?\s*C)\b/gi,
            '<strong>$1°C</strong>'
        );

        // Highlight remaining numeric values.
        text = text.replace(
            /\b\d+(?:\.\d+)?\b/g,
            '<strong>$&</strong>'
        );

        return text;
    }
}