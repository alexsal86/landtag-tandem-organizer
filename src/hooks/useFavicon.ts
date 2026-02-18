import { useEffect } from "react";
import sunflowerSvg from "@/assets/sunflower.svg";

const DEFAULT_FAVICON_URL = "/favicon.svg";

const getFaviconType = (url: string) => {
  const normalizedUrl = url.toLowerCase();

  if (normalizedUrl.includes(".svg") || normalizedUrl.startsWith("data:image/svg+xml")) {
    return "image/svg+xml";
  }
  if (normalizedUrl.includes(".ico") || normalizedUrl.startsWith("data:image/x-icon")) {
    return "image/x-icon";
  }
  if (normalizedUrl.includes(".jpg") || normalizedUrl.includes(".jpeg") || normalizedUrl.startsWith("data:image/jpeg")) {
    return "image/jpeg";
  }

  return "image/png";
};

const updateFaviconLinks = (url: string) => {
  const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
  existingFavicons.forEach((link) => link.remove());

  const iconLink = document.createElement("link");
  iconLink.rel = "icon";
  iconLink.href = url;
  iconLink.type = getFaviconType(url);

  const shortcutLink = document.createElement("link");
  shortcutLink.rel = "shortcut icon";
  shortcutLink.href = url;
  shortcutLink.type = getFaviconType(url);

  const appleTouchIconLink = document.createElement("link");
  appleTouchIconLink.rel = "apple-touch-icon";
  appleTouchIconLink.href = url;

  document.head.appendChild(iconLink);
  document.head.appendChild(shortcutLink);
  document.head.appendChild(appleTouchIconLink);
};

const resolveFaviconSource = (faviconUrl?: string | null) => {
  if (faviconUrl && faviconUrl.trim() !== "") return faviconUrl;
  if (DEFAULT_FAVICON_URL.trim() !== "") return DEFAULT_FAVICON_URL;

  return sunflowerSvg;
};

const renderFaviconAsPngDataUrl = (sourceUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas context could not be created"));
          return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      reject(new Error(`Favicon source could not be loaded: ${sourceUrl}`));
    };

    image.src = sourceUrl;
  });
};

export const useFavicon = (faviconUrl?: string | null) => {
  useEffect(() => {
    let isCancelled = false;

    const sourceUrl = resolveFaviconSource(faviconUrl);

    const applyFavicon = async () => {
      try {
        const generatedPngDataUrl = await renderFaviconAsPngDataUrl(sourceUrl);

        if (!isCancelled) {
          updateFaviconLinks(generatedPngDataUrl);
        }
      } catch (error) {
        if (!isCancelled) {
          console.warn("Favicon could not be generated from source, using direct URL fallback.", error);
          updateFaviconLinks(sourceUrl);
        }
      }
    };

    applyFavicon();

    return () => {
      isCancelled = true;
    };
  }, [faviconUrl]);
};
