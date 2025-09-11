import * as React from 'react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend } from '~/components/ui/chart';
import * as Recharts from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

export interface RepoTypeChartProps {
  data: Array<{
    type: string;
    count: number;
    color?: string;
  }>;
}

export function RepoTypeChart({ data }: RepoTypeChartProps) {
  // context7 配置
  const config = React.useMemo(() => {
    return data.reduce((acc, cur) => {
      acc[cur.type] = {
        label: cur.type,
        color: cur.color || undefined,
      };
      return acc;
    }, {} as Record<string, { label: string; color?: string }>);
  }, [data]);

  return (
    <Card data-slot="repo-type-chart">
      <CardHeader>
        <CardTitle>Repository Types</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="w-full h-64">
          <Recharts.PieChart>
            <Recharts.Pie
              data={data}
              dataKey="count"
              nameKey="type"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} ${(percent * 100).toFixed(1)}%`
              }
              isAnimationActive
            >
              {data.map((entry) => (
                <Recharts.Cell key={`cell-${entry.type}`} fill={entry.color || '#888'} />
              ))}
            </Recharts.Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend verticalAlign="bottom" />
          </Recharts.PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
