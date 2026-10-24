import React from "react";

export function Skeleton({ className = "", style = {} }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function SkeletonText({ width = "100%", height = "12px", className = "" }) {
  return <div className={`skeleton skeleton-text ${className}`} style={{ width, height }} />;
}

export function SkeletonCircle({ size = "40px", className = "" }) {
  return <div className={`skeleton skeleton-circle ${className}`} style={{ width: size, height: size }} />;
}

export function SkeletonCard({ height = "150px", width = "100%", className = "" }) {
  return <div className={`skeleton skeleton-card ${className}`} style={{ height, width }} />;
}
