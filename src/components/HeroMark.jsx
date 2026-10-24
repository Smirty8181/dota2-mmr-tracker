import React from "react";

function HeroMark({ hero, small = false }) {
  return (
    <div className={`hero-mark ${hero.color || "red"} ${small ? "small" : ""} ${hero.art ? "has-art" : ""}`} aria-hidden="true">
      <span>{hero.mark || hero.name?.slice(0, 2).toUpperCase() || "?"}</span>
      {hero.art && (
        <img
          src={hero.art}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
            event.currentTarget.parentElement?.classList.remove("has-art");
          }}
        />
      )}
    </div>
  );
}

export default HeroMark;
