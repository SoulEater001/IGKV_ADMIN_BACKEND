import type { Request, Response } from 'express';
import { WeatherPdfService } from '../services/weather-pdf.service.ts';

export class WeatherPdfController {

  private weatherPdfService: WeatherPdfService;

  constructor() {
    this.weatherPdfService = new WeatherPdfService();
  }

  generateDailyWeatherPdf = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const stationId = Number(req.query.stationId);
      const weatherDataType = String(req.query.weatherDataType ?? '');
      const issueDate = String(req.query.issueDate ?? '');

      const fromDate =
        req.query.fromDate !== undefined &&
          req.query.fromDate !== ''
          ? String(req.query.fromDate)
          : undefined;

      const toDate =
        req.query.toDate !== undefined &&
          req.query.toDate !== ''
          ? String(req.query.toDate)
          : undefined;

      const stateLgCode =
        req.query.stateLgCode !== undefined &&
          req.query.stateLgCode !== ''
          ? Number(req.query.stateLgCode)
          : null;

      const districtLgCode =
        req.query.districtLgCode !== undefined &&
          req.query.districtLgCode !== ''
          ? Number(req.query.districtLgCode)
          : null;

      const blockLgCode =
        req.query.blockLgCode !== undefined &&
          req.query.blockLgCode !== ''
          ? Number(req.query.blockLgCode)
          : null;

      if (!stationId || !issueDate || !fromDate || !toDate) {
        res.status(400).json({
          success: false,
          message:
            'stationId, issueDate, fromDate and toDate are required.'
        });
        return;
      }

      if (!weatherDataType) {
        res.status(400).json({
          success: false,
          message:
            'weatherDataType is required for weather data reports.'
        });
        return;
      }

      if (
        weatherDataType !== 'OBSERVATION' &&
        weatherDataType !== 'FORECAST'
      ) {
        res.status(400).json({
          success: false,
          message:
            'weatherDataType must be OBSERVATION or FORECAST.'
        });
        return;
      }

      if (fromDate > toDate) {
        res.status(400).json({
          success: false,
          message:
            'fromDate cannot be greater than toDate.'
        });
        return;
      }

      if (weatherDataType === 'OBSERVATION') {
        const pdf =
          await this.weatherPdfService.generateDailyWeatherPdf(
            stationId,
            'WEATHER_DATA',
            weatherDataType,
            issueDate,
            fromDate,
            toDate
          );

        const fileName =
          `daily-weather-observation-${issueDate}.pdf`;

        res.setHeader(
          'Content-Type',
          'application/pdf'
        );

        res.setHeader(
          'Content-Disposition',
          `inline; filename="${fileName}"`
        );

        res.setHeader(
          'Content-Length',
          pdf.length
        );

        res.status(200).send(pdf);

        return;
      }

      if (weatherDataType === 'FORECAST') {
        if (
          stateLgCode === null ||
          Number.isNaN(stateLgCode)
        ) {
          res.status(400).json({
            success: false,
            message:
              'stateLgCode is required for forecast reports.'
          });
          return;
        }

        const pdf =
          await this.weatherPdfService.generateDailyWeatherForecastPdf(
            stationId,
            'WEATHER_DATA',
            weatherDataType,
            issueDate,
            stateLgCode,
            fromDate,
            toDate,
            districtLgCode,
            blockLgCode
          );

        const fileName =
          `daily-weather-forecast-${issueDate}.pdf`;

        // const html =
        //   await this.weatherPdfService.generateDailyWeatherForecastHtml(
        //     stationId,
        //     issueDate,
        //     stateLgCode,
        //     fromDate,
        //     toDate,
        //     districtLgCode,
        //     blockLgCode
        //   );

        // res.setHeader(
        //   'Content-Type',
        //   'text/html; charset=utf-8'
        // );

        // res.status(200).send(html);

        res.setHeader(
          'Content-Type',
          'application/pdf'
        );

        res.setHeader(
          'Content-Disposition',
          `inline; filename="${fileName}"`
        );

        res.setHeader(
          'Content-Length',
          pdf.length
        );

        res.status(200).send(pdf);

        return;
      }

    } catch (error) {
      console.error(
        'Daily weather PDF generation failed:',
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to generate daily weather PDF.'
      });
    }
  };

  generateWeatherAdvisoryPdf = async (req: Request, res: Response): Promise<void> => {

    try {

      const stationId = Number(req.query.stationId);
      const reportType = String(req.query.reportType ?? '');

      const options =
        typeof req.query.options === 'string'
          ? JSON.parse(req.query.options)
          : req.query.options;

      const languageId =
        req.query.languageId
          ? Number(req.query.languageId)
          : null;

      if (languageId !== 1 && languageId !== 2) {
        res.status(400).json({
          message: 'Invalid languageId'
        });
        return;
      }

      if (!stationId || !reportType) {
        res.status(400).json({
          success: false,
          message:
            'stationId, reportType and issueDate are required.'
        });
        return;
      }

      if (reportType !== 'WEATHER_ADVISORY') {
        res.status(400).json({
          success: false,
          message:
            'reportType must be WEATHER_ADVISORY.'
        });
        return;
      }

      if (!Array.isArray(options) || options.length === 0) {
        res.status(400).json({
          success: false,
          message:
            'At least one weather advisory option is required.'
        });
        return;
      }

      const invalidOption =
        options.find(
          option =>
            !option?.issueDate ||
            option.stateLgCode == null
        );

      if (invalidOption) {
        res.status(400).json({
          success: false,
          message:
            'Each weather advisory option must contain issueDate and stateLgCode.'
        });
        return;
      }

      const pdf =
        await this.weatherPdfService.generateWeatherAdvisoryPdf(
          stationId,
          reportType,
          options,
          languageId
        );

      const fileName =
        `weather-advisory-${options[0].issue_date}.pdf`;

      res.setHeader(
        'Content-Type',
        'application/pdf'
      );

      res.setHeader(
        'Content-Disposition',
        `inline; filename="${fileName}"`
      );

      res.setHeader(
        'Content-Length',
        pdf.length
      );

      res.status(200).send(pdf);

    } catch (error) {

      console.error(
        'Weather advisory PDF generation failed:',
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to generate weather advisory PDF.'
      });

    }
  };

  getAvailableIssueDates = async (
    req: Request,
    res: Response
  ): Promise<void> => {

    try {
      const stationId = Number(req.query.stationId);
      const reportType = String(req.query.reportType ?? '');
      const weatherDataType = String(req.query.weatherDataType ?? '');

      const year =
        req.query.year !== undefined &&
          req.query.year !== ''
          ? Number(req.query.year)
          : null;

      const month =
        req.query.month !== undefined &&
          req.query.month !== ''
          ? Number(req.query.month)
          : null;

      if (!stationId || !reportType) {
        res.status(400).json({
          success: false,
          message: 'stationId and reportType are required.'
        });
        return;
      }

      if (
        reportType === 'WEATHER_DATA' &&
        !weatherDataType
      ) {
        res.status(400).json({
          success: false,
          message:
            'weatherDataType is required for weather data reports.'
        });
        return;
      }

      const data =
        await this.weatherPdfService.getAvailableIssueDates(
          stationId,
          reportType,
          weatherDataType,
          year,
          month
        );

      res.status(200).json({
        success: true,
        data
      });

    } catch (error) {

      console.error(
        'Failed to get available weather PDF issue dates:',
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get available issue dates.'
      });

    }
  };
}