import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Placeholder data
const data = [
  { month: "Jan", gross: 0, net: 0, tax: 0 },
  { month: "Feb", gross: 0, net: 0, tax: 0 },
  { month: "Mar", gross: 0, net: 0, tax: 0 },
  { month: "Apr", gross: 0, net: 0, tax: 0 },
  { month: "May", gross: 0, net: 0, tax: 0 },
  { month: "Jun", gross: 0, net: 0, tax: 0 },
];

const PayslipChart = () => {
  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="gross"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            name="Gross Pay"
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            name="Net Pay"
          />
          <Line
            type="monotone"
            dataKey="tax"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            name="Tax"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-center mt-4 text-sm text-muted-foreground">
        Upload payslips to see your income trends
      </div>
    </div>
  );
};

export default PayslipChart;
