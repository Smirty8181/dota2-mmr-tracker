import React from "react";
import { motion } from "framer-motion";

function LoadingScreen({ hero }) {
  const heroImage = hero?.image || "";
  const heroIcon = hero?.art || "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="loading-screen"
      role="status"
      aria-label="Загрузка Dota2 MMR Tracker"
      style={heroImage ? { "--loading-hero-background": `url("${heroImage}")` } : undefined}
    >
      <div className="loading-mist" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="loading-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="loading-content">
        <span className="loading-kicker">DOTA 2 · PLAYER HUB</span>
        <img className="loading-logo" src="/assets/dota-mmr-tracker-logo-transparent.png" alt="" />
        {heroIcon && <img className="loading-hero-icon" src={heroIcon} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
        <div className="loading-hero-name">{hero?.name ? `${hero.name} · DOTA 2` : "DOTA 2 · MMR TRACKER"}</div>
        <div className="loading-orbit"><i /><i /><i /></div>
        <div className="loading-caption">Подготавливаем вашу сводку<span className="loading-dots">...</span></div>
        <div className="loading-progress-track" aria-hidden="true"><i /></div>
        <span className="loading-footnote">ЗАГРУЗКА ПУБЛИЧНЫХ ДАННЫХ</span>
      </div>
      <div className="loading-runes">DOTA 2　·　MMR TRACKER</div>
    </motion.div>
  );
}

export default LoadingScreen;
