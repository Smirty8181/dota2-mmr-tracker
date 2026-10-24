import React from "react";

function MedalEmblem({ rank, tier, className = "" }) {
  const medalTier = Number.isInteger(tier) && tier > 0
    ? Math.min(8, Math.floor(tier / 10))
    : 0;
  const medalStars = Number.isInteger(tier) ? tier % 10 : 0;
  return (
    <div className={`medal-emblem ${className}`} role="img" aria-label={Number.isInteger(tier) && tier > 0 ? `Медаль Dota 2: ${rank}, ${medalStars} звёзд` : "Медаль Dota 2: ранг не опубликован"}>
      <img className="medal-rank-icon" src={`https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_${medalTier}.png`} alt="" loading="lazy" />
      {medalStars > 0 && medalStars <= 5 && <span className="medal-star-count" aria-hidden="true">{medalStars}★</span>}
    </div>
  );
}

export default MedalEmblem;
