import fs from 'fs/promises';
import path from 'path';
import { resolveWeatherPdfStationTemplate, resolveWeatherPdfTemplateFiles } from "../config/weather-pdf-template.config.js";

export class WeatherPdfTemplateService {

    getTemplateDirectory(reportType, weatherDataType, station) {
        const basePath = path.join(process.cwd(), 'modules', 'pdf', 'templates');

        const template = resolveWeatherPdfStationTemplate({
            id: station.id,
            station_name: station.station_name,
            station_code: station.station_code,
            state_lg_code: station.state_lg_code,
            district_lg_code: station.district_lg_code,
            block_lg_code: station.block_lg_code
        });

        if (!template) {
            throw new Error(`No PDF template mapping found for station ${station.id}`);
        }

        if (reportType === 'WEATHER_DATA') {
            if (weatherDataType === 'OBSERVATION') {
                return path.join(basePath, 'weather-data', 'observation', template);
            }
            if (weatherDataType === 'FORECAST') {
                return path.join(basePath, 'weather-data', 'forecast', template);
            }
        }

        if (reportType === 'WEATHER_ADVISORY') {
            return path.join(basePath, 'weather-advisory', template);
        }

        throw new Error(`Template not implemented for ${reportType} ${weatherDataType}.`);
    }
    async loadTemplate(reportType, weatherDataType, station, languageId) {

        const templateDirectory = this.getTemplateDirectory(reportType, weatherDataType, station);

        const templateFiles = resolveWeatherPdfTemplateFiles(reportType, weatherDataType, languageId);

        if (!templateFiles) {
            throw new Error(`No PDF template files configured for ${reportType} ${weatherDataType}`);
        }

        const templatePath = path.join(templateDirectory, templateFiles.html);

        const cssPath = path.join(templateDirectory, templateFiles.css);

        const logoPath = templateFiles.logo
            ? path.join(templateDirectory, templateFiles.logo)
            : null;

        const govLogoPath = templateFiles.govLogo
            ? path.join(templateDirectory, templateFiles.govLogo)
            : null;

        const requiredFiles = [
            templatePath,
            cssPath,
            ...(logoPath ? [logoPath] : [])
        ];

        for (const file of requiredFiles) {
            try {
                await fs.access(file);
            }
            catch {
                throw new Error(`PDF template file missing: ${file}`);
            }
        }

        let logo = '';
        let govLogo = '';

        if (logoPath) {
            const logoBuffer = await fs.readFile(logoPath);
            logo =
                `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }

        if (govLogoPath) {
            try {
                await fs.access(govLogoPath);
                const govLogoBuffer = await fs.readFile(govLogoPath);
                govLogo =
                    `data:image/png;base64,${govLogoBuffer.toString('base64')}`;
            }
            catch {
                govLogo = '';
            }
        }

        const html = await fs.readFile(templatePath, 'utf-8');
        const css = await fs.readFile(cssPath, 'utf-8');

        return {
            html,
            css,
            logo,
            govLogo
        };
    }
}
