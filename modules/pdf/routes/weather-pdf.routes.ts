import { Router } from 'express';
import { WeatherPdfController } from '../controllers/weather-pdf.controller.ts';

const router = Router();

const controller =
  new WeatherPdfController();

router.get(
  '/weather-data',
  controller.generateDailyWeatherPdf
);

router.get(
  '/issue-dates',
  controller.getAvailableIssueDates
);

router.get(
  '/weather-advisory',
  controller.generateWeatherAdvisoryPdf
);

export default router;