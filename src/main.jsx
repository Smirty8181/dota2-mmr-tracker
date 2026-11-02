import React from "react";
import ReactDOM from "react-dom/client";

if (import.meta.env.VITE_STATIC_PREVIEW === "true") {
  Promise.all([import("./preview/StaticPreview.jsx"), import("./preview/preview.css")]).then(([{ default: StaticPreview }]) => {
    ReactDOM.createRoot(document.getElementById("root")).render(<StaticPreview />);
  });
} else {
  Promise.all([import("./App.jsx"), import("./styles.css")]).then(([{ default: App }]) => {
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
}
