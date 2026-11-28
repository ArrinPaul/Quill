import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quill",
    short_name: "Quill",
    description: "Deadlines, notes, attendance and study tools for students.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f6f5f4",
    theme_color: "#6f1d2f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
