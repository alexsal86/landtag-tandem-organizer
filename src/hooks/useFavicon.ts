import { useEffect } from "react";

const getFaviconType = (url: string) => {
  const normalizedUrl = url.toLowerCase();

  if (normalizedUrl.includes(".svg")) return "image/svg+xml";
  if (normalizedUrl.includes(".ico")) return "image/x-icon";
  if (normalizedUrl.includes(".png")) return "image/png";
  if (normalizedUrl.includes(".jpg") || normalizedUrl.includes(".jpeg")) return "image/jpeg";

  return "image/png";
};

export const useFavicon = (faviconUrl?: string | null) => {
  useEffect(() => {
    const url = faviconUrl || '/src/assets/sunflower.svg';


    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach((link) => link.remove());

    const faviconLink = document.createElement("link");
    faviconLink.rel = "icon";
    faviconLink.href = url;
    faviconLink.type = getFaviconType(url);

    document.head.appendChild(faviconLink);
  }, [faviconUrl]);
};
