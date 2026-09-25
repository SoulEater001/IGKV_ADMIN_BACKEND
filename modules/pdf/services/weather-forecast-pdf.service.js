import { escapeHtml, toNumber, formatDate, displayValue } from "../utils/weather-pdf-format.utils.js";


export class WeatherForecastPdfService {
    repository;
    renderer;
    templateService;
    constructor(repository, renderer, templateService) {
        this.repository = repository;
        this.renderer = renderer;
        this.templateService = templateService;
    }


    async getDailyWeatherForecastReport(stationId, issueDate, stateLgCode, fromDate, toDate, districtLgCode, blockLgCode) {
        const station = await this.repository.getStation(stationId);

        if (!station) {
            throw new Error('Weather station not found');
        }

        const location = await this.repository.getLocationNames(stateLgCode, districtLgCode ?? null, blockLgCode ?? null);
        const rows = await this.repository.getForecasts(stationId, issueDate, stateLgCode, fromDate, toDate, districtLgCode, blockLgCode);

        const forecasts = rows.map(row => ({
            forecastDate: formatDate(row.forecast_date),
            rainfall: toNumber(row.rainfall),
            maxTemperature: toNumber(row.max_temperature),
            minTemperature: toNumber(row.min_temperature),
            cloudAmount: toNumber(row.cloud_amount),
            relativeHumidity1: toNumber(row.relative_humidity_1),
            relativeHumidity2: toNumber(row.relative_humidity_2),
            windSpeed: toNumber(row.wind_speed),
            windDirection: row.wind_direction ?? null
        }));

        const reportDate = fromDate ??
            (rows.length > 0
                ? String(rows[0].forecast_date).slice(0, 10)
                : issueDate);

        const reportDateObj = new Date(`${reportDate}T00:00:00`);

        return {
            station,
            stateLgCode,
            stateNameEn: location?.state_name_en ?? null,
            stateNameHi: location?.state_name_hi ?? null,
            districtLgCode: districtLgCode ?? null,
            districtNameEn: location?.district_name_en ?? null,
            districtNameHi: location?.district_name_hi ?? null,
            blockLgCode: blockLgCode ?? null,
            blockNameEn: location?.block_name_en ?? null,
            blockNameHi: location?.block_name_hi ?? null,
            issueDate,
            reportMonth: reportDateObj.toLocaleString('en-US', { month: 'long' }),
            reportYear: reportDateObj.getFullYear(),
            forecasts
        };
    }


    async generateDailyWeatherForecastHtml(stationId, issueDate, stateLgCode, fromDate, toDate, districtLgCode, blockLgCode) {
        const report = await this.getDailyWeatherForecastReport(stationId, issueDate, stateLgCode, fromDate, toDate, districtLgCode, blockLgCode);
        return this.buildForecastHtml(report, 'WEATHER_DATA', 'FORECAST');
    }


    async generateDailyWeatherForecastPdf(stationId, reportType, weatherDataType, issueDate, stateLgCode, fromDate, toDate, districtLgCode, blockLgCode) {
        const report = await this.getDailyWeatherForecastReport(stationId, issueDate, stateLgCode, fromDate, toDate, districtLgCode, blockLgCode);
        const html = await this.buildForecastHtml(report, reportType, weatherDataType);
        return this.renderer.render(html);
    }


    async buildForecastHtml(report, reportType, weatherDataType) {

        const template = await this.templateService.loadTemplate(reportType, weatherDataType, report.station);
        let html = template.html;
        let css = template.css;
        let govLogo = template.govLogo;
        let logo = template.logo;

        const forecastRows = report.forecasts
            .map(forecast => `
        <tr>
          <td>${escapeHtml(forecast.forecastDate)}</td>
          <td>${displayValue(forecast.maxTemperature)}</td>
          <td>${displayValue(forecast.minTemperature)}</td>
          <td>${displayValue(forecast.rainfall)}</td>
          <td>${displayValue(forecast.cloudAmount)}</td>
          <td>${displayValue(forecast.relativeHumidity1)}</td>
          <td>${displayValue(forecast.relativeHumidity2)}</td>
          <td>${displayValue(forecast.windSpeed)}</td>
          <td>${escapeHtml(forecast.windDirection ?? '')}</td>
        </tr>
      `)
            .join('');

        const blockHeading = report.blockLgCode && report.blockNameEn
            ? `<div class="block-heading">Block - ${escapeHtml(report.blockNameEn)}</div>`
            : '';

        html = html
            .replace('/*WEATHER_PDF_CSS*/', css)
            .replace('{{logo}}', logo)
            .replace('{{leftLogo}}', logo)
            .replace('{{govtLogo}}', govLogo)
            .replace('{{reportMonth}}', escapeHtml(report.reportMonth))
            .replace('{{reportYear}}', String(report.reportYear))
            // .replace('{{bulletinNo}}', bulletinNo != null ? String(bulletinNo) : '')
            // .replace('{{issueDate}}', escapeHtml(report.issueDate))
            .replace('{{districtNameEn}}', escapeHtml(report.districtNameEn ?? ''))
            .replace('{{blockHeading}}', blockHeading)
            .replace('{{forecastRows}}', forecastRows);
        return html;
    }
}
