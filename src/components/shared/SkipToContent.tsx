/**
 * Accessibility: Skip-to-content link for keyboard navigation.
 * Place at the top of the layout, before the navigation.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Zum Inhalt springen
    </a>
  );
}
