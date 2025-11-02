import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/currencyUtils";

interface PayslipData {
  gross_pay: number;
  net_pay: number;
  created_at: string;
}

interface PayslipChartProps {
  data: PayslipData[];
  currency?: string;
}

const PayslipChart = ({ data, currency = "EUR" }: PayslipChartProps) => {
  // Transform data for the chart
  const chartData = data
    .map((payslip) => {
      const date = new Date(payslip.created_at);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        grossPay: payslip.gross_pay,
        netPay: payslip.net_pay,
        timestamp: date.getTime(),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-12); // Show last 12 entries

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p>Upload payslips to see your income trends</p>
      </div>
    );
  }

  return (
    <ChartContainer
      config={{
        grossPay: {
          label: "Gross Pay",
          color: "hsl(var(--primary))",
        },
        netPay: {
          label: "Net Pay",
          color: "hsl(var(--chart-2))",
        },
      }}
      className="h-[300px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="month" 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => formatCurrency(value, currency).replace(/\.\d{2}/, '')}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number) => formatCurrency(value, currency)}
          />
          <Area
            type="monotone"
            dataKey="grossPay"
            stroke="hsl(var(--primary))"
            fillOpacity={1}
            fill="url(#colorGross)"
            name="Gross Pay"
          />
          <Area
            type="monotone"
            dataKey="netPay"
            stroke="hsl(var(--chart-2))"
            fillOpacity={1}
            fill="url(#colorNet)"
            name="Net Pay"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default PayslipChart;
