"use client";

import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CategoryBadge, categoryColor } from "@/components/category-badge";

type Category = {
  category: string;
  total: number | string;
  percentage: number | string;
};
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percentage = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const evolutionConfig = {
  income: { label: "Receitas", color: "var(--signal)" },
  expense: { label: "Despesas", color: "#80a9ef" },
} satisfies ChartConfig;

export function Evolution({
  chart,
}: {
  chart: { labels: string[]; income: number[]; expense: number[] };
}) {
  const rows = chart.labels.map((month, i) => ({
    month,
    income: chart.income[i],
    expense: chart.expense[i],
  }));
  return (
    <ChartContainer config={evolutionConfig} className="h-64 w-full">
      <BarChart
        accessibilityLayer
        aria-label="Receitas e despesas dos últimos seis meses"
        data={rows}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span>
                  {evolutionConfig[name as keyof typeof evolutionConfig]?.label}{" "}
                  · {money.format(Number(value))}
                </span>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="income"
          fill="var(--color-income)"
          radius={[5, 5, 0, 0]}
        />
        <Bar
          dataKey="expense"
          fill="var(--color-expense)"
          radius={[5, 5, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

export function CategoryChart({
  rows,
  total,
}: {
  rows: Category[];
  total: number | string;
}) {
  if (!rows.length)
    return <p className="empty">Nenhuma despesa registrada neste mês.</p>;
  const data = rows.map((row) => ({
    category: row.category,
    total: Number(row.total),
    fill: categoryColor(row.category),
  }));

  return (
    <div className="category-breakdown">
      <div className="category-chart">
        <ChartContainer
          config={{ total: { label: "Despesas" } }}
          className="h-40 w-full"
        >
          <PieChart
            accessibilityLayer
            aria-label="Distribuição de despesas por categoria"
          >
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => (
                    <span>
                      {item.payload.category} · {money.format(Number(value))}
                    </span>
                  )}
                />
              }
            />
            <Pie
              data={data}
              dataKey="total"
              nameKey="category"
              innerRadius={55}
              outerRadius={74}
              stroke="var(--card)"
              strokeWidth={2}
            />
          </PieChart>
        </ChartContainer>
        <div className="chart-total">
          <small>Total de despesas</small>
          <strong>{money.format(Number(total))}</strong>
        </div>
      </div>
      <div className="category-list">
        {rows.map((row) => (
          <div key={row.category}>
            <CategoryBadge category={row.category} />
            <span className="category-amount">
              {percentage.format(Number(row.percentage))}%{" "}
              <small>{money.format(Number(row.total))}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
