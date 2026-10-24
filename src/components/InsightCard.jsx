import React from "react";
import HeroMark from "./HeroMark";
import { formatEstimatedMmrChange } from "../../shared/mmr.js";

function InsightCard({ match }) {
  const isWin = match.result === "Победа";

  return (
    <div className={`insight-card ${isWin ? "win" : "loss"}`}>
      <div className="insight-card-header">
        <div className="insight-card-left">
          <HeroMark hero={match} small />
          <div className="insight-card-info">
            <b>{match.hero}</b>
            <small>{match.date}</small>
          </div>
        </div>
        <div className="insight-card-result">
          <span className={`result-badge ${isWin ? "win" : "loss"}`}>
            {isWin ? "Победа" : "Поражение"}
          </span>
          <span className={`mmr-delta ${match.mmr > 0 ? "positive" : match.mmr < 0 ? "negative" : ""}`} title="Расчёт приложения по модели ±25 MMR за рейтинговую игру; не официальный результат Valve">
            {formatEstimatedMmrChange(match.mmr)}
          </span>
        </div>
      </div>
      <div className="insight-card-stats">
        <div className="stat-item">
          <span>KDA</span>
          <b>{match.kda}</b>
        </div>
        <div className="stat-item">
          <span>GPM</span>
          <b>{match.gpm ?? "—"}</b>
        </div>
        <div className="stat-item">
          <span>XPM</span>
          <b>{match.xpm ?? "—"}</b>
        </div>
      </div>
    </div>
  );
}

export default InsightCard;
