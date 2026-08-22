import { useSearchParams } from "react-router";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { DollarSign, Star, Users } from "lucide-react";
import { formatPrice } from "~/lib/utils";
import type { AnalyticsPeriod, InstructorAnalytics } from "~/services/analyticsService";

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
];

interface AnalyticsDashboardProps {
  period: AnalyticsPeriod;
  analytics: InstructorAnalytics;
}

export function AnalyticsDashboard({
  period,
  analytics,
}: AnalyticsDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  function handlePeriodChange(value: string) {
    const next = new URLSearchParams(searchParams);
    next.set("period", value);
    setSearchParams(next);
  }

  const { summary } = analytics;

  return (
    <div>
      <Tabs value={period} onValueChange={handlePeriodChange} className="mb-6">
        <TabsList>
          {PERIOD_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </span>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(summary.totalRevenueCents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total Enrollments
            </span>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalEnrollments}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Average Rating
            </span>
            <Star className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.averageRating !== null
                ? `${summary.averageRating.toFixed(1)} / 5`
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.ratingCount}{" "}
              {summary.ratingCount === 1 ? "rating" : "ratings"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
