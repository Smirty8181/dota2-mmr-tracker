import React from "react";

function FavoriteHeroArtwork({ hero }) {
  if (!hero) return null;
  const artImage = hero.artImage || hero.image;

  return (
    <>
      {artImage && (
        <div
          className="hero-background-art"
          role="presentation"
          style={{ backgroundImage: `url("${artImage}")` }}
        />
      )}
    </>
  );
}

export default FavoriteHeroArtwork;
