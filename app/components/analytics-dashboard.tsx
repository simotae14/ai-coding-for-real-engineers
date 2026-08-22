import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn, formatPrice } from "~/lib/utils";
import { DollarSign, Users, Star, ArrowUpDown } from "lucide-react";
import type {
  TimePeriod,
  AnalyticsSummary,
  RevenueDataPoint,
  CourseBreakdown,
} from "~/services/analyticsService";

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
];

type SortColumn = keyof Pick<
  CourseBreakdown,
  | "title"
  | "listPrice"
  | "revenue"
  | "salesCount"
  | "enrollmentCount"
  | "averageRating"
  | "ratingCount"
>;

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: "title", label: "Course" },
  { key: "listPrice", label: "List Price" },
  { key: "revenue", label: "Revenue" },
  { key: "salesCount", label: "Sales" },
  { key: "enrollmentCount", label: "Enrollments" },
  { key: "averageRating", label: "Avg Rating" },
  { key: "ratingCount", label: "Ratings" },
];

function formatChartDate(date: string): string {
  return date.length === 7
    ? new Date(`${date}-01T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
}

interface AnalyticsDashboardProps {
  summary: AnalyticsSummary;
  timeSeries: RevenueDataPoint[];
  courseBreakdown: CourseBreakdown[];
  period: TimePeriod;
}

export function AnalyticsDashboard({
  summary,
  timeSeries,
  courseBreakdown,
  period,
}: AnalyticsDashboardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sortColumn, setSortColumn] = useState<SortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedCourses = useMemo(() => {
    const sorted = [...courseBreakdown].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === "string" || typeof bValue === "string") {
        return String(aValue).localeCompare(String(bValue));
      }
      return (aValue as number) - (bValue as number);
    });

    if (sortDirection === "desc") sorted.reverse();
    return sorted;
  }, [courseBreakdown, sortColumn, sortDirection]);

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  }

  function handlePeriodChange(newPeriod: TimePeriod) {
    const params = new URLSearchParams(searchParams);
    params.set("period", newPeriod);
    navigate(`?${params.toString()}`, { replace: true });
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePeriodChange(p.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              period === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(summary.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Enrollments
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalEnrollments.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Rating
            </CardTitle>
            <Star className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.averageRating !== null
                ? `${summary.averageRating.toFixed(1)} / 5`
                : "N/A"}
            </div>
            {summary.ratingCount > 0 && (
              <p className="text-xs text-muted-foreground">
                from {summary.ratingCount}{" "}
                {summary.ratingCount === 1 ? "rating" : "ratings"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Revenue Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeSeries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No revenue data for this period.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(value) => formatPrice(value)}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    width={80}
                  />
                  <Tooltip
                    formatter={(value) => formatPrice(Number(value))}
                    labelFormatter={(label) => formatChartDate(String(label))}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary, #6366f1)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Course Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Course Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedCourses.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No courses to show for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {COLUMNS.map((column) => (
                      <th key={column.key} className="pb-2 pr-4">
                        <button
                          onClick={() => handleSort(column.key)}
                          className={cn(
                            "flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground",
                            sortColumn === column.key && "text-foreground"
                          )}
                        >
                          {column.label}
                          <ArrowUpDown className="size-3" />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCourses.map((course) => (
                    <tr key={course.courseId} className="border-b last:border-0">
                      <td className="py-2 pr-4">{course.title}</td>
                      <td className="py-2 pr-4">
                        {formatPrice(course.listPrice)}
                      </td>
                      <td className="py-2 pr-4">{formatPrice(course.revenue)}</td>
                      <td className="py-2 pr-4">{course.salesCount}</td>
                      <td className="py-2 pr-4">{course.enrollmentCount}</td>
                      <td className="py-2 pr-4">
                        {course.averageRating !== null
                          ? course.averageRating.toFixed(1)
                          : "N/A"}
                      </td>
                      <td className="py-2 pr-4">{course.ratingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
