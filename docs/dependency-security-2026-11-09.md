# Dependency security update

Both `bun.lock` and `package-lock.json` were refreshed without adding transitive dependency overrides. Direct dependencies were updated where compatible transitive resolution alone was insufficient.

## Verified fixes

The requested fixes now resolve for @supabase/supabase-js, @tailwindcss/postcss, @tailwindcss/vite, @vitejs/plugin-react, autoprefixer, docx, dompurify, jsdom, jspdf, lovable-tagger, mammoth, matrix-js-sdk, pdfjs-dist, postcss, react-big-calendar, react-native, react-router-dom, vite-plugin-node-polyfills, vitest, and direct zod.

Examples checked in both lockfiles: ws 8.22.2 / 7.5.13, nanoid 3.3.20 / 6.0.2, postcss 8.5.32, source-map-js 1.2.2, dompurify 3.4.17, @xmldom/xmldom 0.8.15 / 0.9.12, browserslist 4.29.5, moment 2.31.0, react-router 7.18.5, vite 8.3.7, vitest and @vitest/mocker 4.1.12.

PDF and Matrix integrations were adapted to their updated APIs; PDF workers now come from the installed package rather than an old static worker or a CDN.

## Remaining blockers

- **expo 55.0.32:** its supported SDK 55 tooling still requires zod 3.25.76, glob 13.0.7, and minimatch 10.2.6, below the requested fixed version floors. Removing these requires a coordinated mobile SDK upgrade rather than forcing incompatible transitive majors.
- **expo-router 55.0.18:** query-string 7 still requires decode-uri-component 0.2.2; a coordinated mobile SDK/router upgrade is required.
- **xlsx 0.18.5:** the standing project licensing restriction prohibits the requested newer releases. The two high-severity advisories remain unresolved; preserving the pin is not a security fix. An approved replacement or a licensing decision is required.
- **Additional npm audit findings:** expo also includes deepmerge (low severity), and vite-plugin-node-polyfills 0.28.0 includes elliptic (low severity, no patched release). These remain unresolved upstream dependency constraints.

No findings were suppressed. The production dependency scanner still reports seven advisories across expo, expo-router, and xlsx. npm audit additionally covers developer tools and reports the low-severity findings above and their dependency chains.

## Validation

- Automatic preview build: successful after the API adaptations and patched Vite toolchain.
- Targeted regression suite: 4 files, 31 tests passed, including Matrix message mapping, briefing conversions, agenda rules, and editorial planner rules.
- Native Android/iOS builds and authenticated user workflows were not verified.