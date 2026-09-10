import { resolveWeatherPdfStationTemplate } from "../config/weather-pdf-template.config.ts";
import type { WeatherPdfStationContext } from "../types/weather-pdf.types.ts";
import path from 'path';

export class WeatherPdfTemplateService{
 getTemplateDirectory(
    reportType: string,
    weatherDataType: string,
    station: WeatherPdfStationContext
  ): string {

    const basePath = path.join(
      process.cwd(),
      'modules',    
      'pdf',
      'templates'
    );

    const template =
      resolveWeatherPdfStationTemplate({
        id: station.id,
        station_name: station.station_name,
        station_code: station.station_code,
        state_lg_code: station.state_lg_code,
        district_lg_code: station.district_lg_code,
        block_lg_code: station.block_lg_code
      });

    if (!template) {
      throw new Error(
        `No PDF template mapping found for station ${station.id}`
      );
    }

    if (reportType === 'WEATHER_DATA') {

      if (weatherDataType === 'OBSERVATION') {
        return path.join(
          basePath,
          'weather-data',
          'observation',
          template
        );
      }

      if (weatherDataType === 'FORECAST') {
        return path.join(
          basePath,
          'weather-data',
          'forecast',
          template
        );
      }
    }

    if (reportType === 'WEATHER_ADVISORY') {
      return path.join(
        basePath,
        'weather-advisory',
        template
      );
    }

    throw new Error(
      `Template not implemented for ${reportType} ${weatherDataType}.`
    );
  }
}