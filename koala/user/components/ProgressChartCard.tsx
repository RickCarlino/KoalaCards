import {
  ChartTooltip,
  toChartTooltipItems,
} from "@/koala/user/components/ChartTooltip";
import { ChartDataPoint } from "@/koala/user/types";
import { AreaChart } from "@mantine/charts";
import { Card, Grid, Title } from "@mantine/core";

export function ProgressChartCard(props: {
  title: string;
  data: ChartDataPoint[];
  seriesLabel: string;
  yAxisLabel: string;
}) {
  return (
    <Grid.Col span={{ base: 12, md: 6 }}>
      <Title order={4} mb="xs">
        {props.title}
      </Title>
      <Card withBorder shadow="xs" p="md" radius="md">
        <AreaChart
          h={300}
          data={props.data}
          dataKey="date"
          series={[
            { name: "count", color: "blue", label: props.seriesLabel },
          ]}
          curveType="natural"
          yAxisLabel={props.yAxisLabel}
          xAxisLabel="Date"
          tooltipProps={{
            content: ({ label, payload }) => (
              <ChartTooltip
                label={label}
                items={toChartTooltipItems(payload)}
              />
            ),
          }}
          gridProps={{ strokeDasharray: "3 3" }}
        />
      </Card>
    </Grid.Col>
  );
}
