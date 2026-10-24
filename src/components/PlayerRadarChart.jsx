import React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

function PlayerRadarChart({ data, accentColor = "#E34B48" }) {
  if (!data?.length) {
    return <div className="empty-state radar-empty">Недостаточно данных для анализа</div>;
  }

  return (
    <div className="radar-chart-wrap" style={{ height: "250px", width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#243140" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#8492a4", fontSize: 10, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Player"
            dataKey="A"
            stroke={accentColor}
            fill={accentColor}
            fillOpacity={0.5}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PlayerRadarChart;
