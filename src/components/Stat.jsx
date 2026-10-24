import React from "react";

function Stat({ label, value, sub, icon: Icon }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

export default Stat;
