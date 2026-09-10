import type {
  DailyWeatherObservation,
  DailyWeatherMean,
  DailyWeatherTotal
} from '../types/weather-pdf.types.ts';

function average(
  values: (number | null | undefined)[]
): number | null {
  const validValues = values.filter(
    (value): value is number =>
      value !== null &&
      value !== undefined &&
      !Number.isNaN(Number(value))
  );

  if (validValues.length === 0) {
    return null;
  }

  const total = validValues.reduce(
    (sum, value) => sum + Number(value),
    0
  );

  return total / validValues.length;
}

function sum(
  values: (number | null | undefined)[]
): number | null {
  const validValues = values.filter(
    (value): value is number =>
      value !== null &&
      value !== undefined &&
      !Number.isNaN(Number(value))
  );

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce(
    (total, value) => total + Number(value),
    0
  );
}

export function calculateWeatherMean(
  observations: DailyWeatherObservation[]
): DailyWeatherMean {
  return {
    maxTemperature: average(
      observations.map(o => o.maxTemperature)
    ),

    minTemperature: average(
      observations.map(o => o.minTemperature)
    ),

    relativeHumidity1: average(
      observations.map(o => o.relativeHumidity1)
    ),

    relativeHumidity2: average(
      observations.map(o => o.relativeHumidity2)
    ),

    vapourPressure1: average(
      observations.map(o => o.vapourPressure1)
    ),

    vapourPressure2: average(
      observations.map(o => o.vapourPressure2)
    ),

    windSpeed: average(
      observations.map(o => o.windSpeed)
    ),

    sunshineHours: average(
      observations.map(o => o.sunshineHours)
    )
  };
}

export function calculateWeatherTotal(
  observations: DailyWeatherObservation[]
): DailyWeatherTotal {
  return {
    rainfall: sum(
      observations.map(o => o.rainfall)
    ),

    evaporation: sum(
      observations.map(o => o.evaporation)
    )
  };
}

export function roundValue(
  value: number | null,
  decimals = 1
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const factor = Math.pow(10, decimals);

  return Math.round(value * factor) / factor;
}