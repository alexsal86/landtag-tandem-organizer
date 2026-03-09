import { Suspense, useEffect } from "react";
import { BrowserRouter, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { MatrixUnreadProvider } from "@/contexts/MatrixUnreadContext";
import { GlobalOverlays } from "@/components/layout/GlobalOverlays";
import { SkipToContent } from "@/components/shared/SkipToContent";
import { AppRoutes } from "./routes";

export const AppRouter = () => {
  // Guard: COI Service Worker nur in iframes deaktivieren
  useEffect(() => {
    const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    if (isInIframe) {
      sessionStorage.removeItem('coi-cleanup-state');
    }
  }, []);

  return (
    <>
      <SkipToContent />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MatrixUnreadProvider>
          <GlobalOverlays />
          <Suspense
            fallback={<div className="min-h-screen bg-gradient-subtle flex items-center justify-center" />}
          >
            <Routes>
              {AppRoutes()}
            </Routes>
          </Suspense>
        </MatrixUnreadProvider>
      </BrowserRouter>
    </>
  );
};
