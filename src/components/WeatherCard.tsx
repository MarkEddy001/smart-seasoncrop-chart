import { Cloud, CloudRain, Droplets, Sun, Wind, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { rainfallRiskLabel, RAIN_DROUGHT_MM, RAIN_FLOOD_MM } from "@/lib/status";
import type { FieldWeather } from "@/lib/weather";

export function WeatherCard({
  weather,
  loading,
  error,
}: {
  weather: FieldWeather | null;
  loading: boolean;
  error: string | null;
}) {
  const Icon = weather
    ? weather.weatherCode >= 51
      ? CloudRain
      : weather.weatherCode >= 2
        ? Cloud
        : Sun
    : Cloud;

  const risk = weather ? rainfallRiskLabel(weather.rainfall7dMm) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Cloud className="h-4 w-4 text-muted-foreground" /> Weather
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-full" />
          </>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : weather ? (
          <>
            <div className="flex items-center gap-3">
              <Icon className="h-9 w-9 text-primary" />
              <div>
                <div className="text-2xl font-semibold">
                  {Math.round(weather.temperatureC)}°C
                </div>
                <div className="text-xs text-muted-foreground">{weather.weatherLabel}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wind className="h-3.5 w-3.5" /> {Math.round(weather.windKph)} km/h
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Droplets className="h-3.5 w-3.5" /> {weather.rainfall7dMm} mm / 7d
              </div>
            </div>
            {risk && (
              <div className="flex items-start gap-2 rounded-md bg-warning/15 text-warning-foreground border border-warning/40 p-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">{risk}</div>
                  <div className="opacity-80">
                    Healthy range: {RAIN_DROUGHT_MM}–{RAIN_FLOOD_MM} mm in last 7 days.
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
