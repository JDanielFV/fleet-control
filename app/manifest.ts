import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fleet Control - Any",
    short_name: "FleetControl",
    description: "Sistema Inteligente de Control de Flotas y Expedientes",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfd", // Matches theme background
    theme_color: "#fbfbfd",      // Prevent emerald color fill in safe area
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      }
    ],
  };
}
