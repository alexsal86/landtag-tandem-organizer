import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";

const upsertMetaTag = (name: string, content: string) => {
  let metaTag = document.querySelector(`meta[name="${name}"]`);

  if (!metaTag) {
    metaTag = document.createElement("meta");
    metaTag.setAttribute("name", name);
    document.head.appendChild(metaTag);
  }

  metaTag.setAttribute("content", content);
};

export const AppHeadManager = () => {
  const { app_name: appName, app_subtitle: appSubtitle } = useAppSettings();

  useEffect(() => {
    const title = `${appName} - ${appSubtitle}`;
    const description = `Plattform zur Koordination der Arbeit von ${appName}. Alles in einer Plattform.`;

    document.title = title;
    upsertMetaTag("description", description);
    upsertMetaTag("author", appName);
  }, [appName, appSubtitle]);

  return null;
};
