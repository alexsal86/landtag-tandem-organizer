# Vite Vendor Chunk Splitting Optimization

This document explains the vendor chunk splitting optimization implemented in `vite.config.ts`.

## Overview

The optimized configuration separates vendor libraries into logical chunks to improve:
- **Caching efficiency**: Vendor chunks change less frequently than application code
- **Parallel loading**: Browser can load chunks simultaneously
- **Bundle size**: Smaller individual chunks load faster
- **Performance**: Better cache hit ratios for returning users

## Chunk Strategy

The configuration creates 9 dedicated vendor chunks:

### 1. React Vendor (`react-vendor`)
- `react` - React core library
- `react-dom` - React DOM renderer

### 2. Supabase Vendor (`supabase-vendor`) 
- `@supabase/supabase-js` - Supabase client library

### 3. Radix Vendor (`radix-vendor`)
All Radix UI component libraries:
- 27 individual `@radix-ui/react-*` packages
- Provides consistent UI component styling and behavior

### 4. UI Vendor (`ui-vendor`)
General UI utilities and icon libraries:
- `lucide-react` - Icon library
- `class-variance-authority` - CSS variant management
- `clsx` & `tailwind-merge` - Class name utilities
- `cmdk`, `vaul`, `sonner` - Additional UI components
- `next-themes` - Theme management
- `input-otp` - OTP input component

### 5. Editor Vendor (`editor-vendor`)
Rich text editing libraries:
- `lexical` - Meta's rich text editor framework
- `@lexical/react` - React bindings for Lexical
- `katex` - Math formula rendering

### 6. Document Vendor (`document-vendor`)
Document processing and generation:
- `jspdf` - PDF generation
- `docx` - Word document creation
- `xlsx` - Excel file handling
- `html2canvas` - HTML to canvas conversion
- `papaparse` - CSV parsing
- `vcf` - vCard file handling

### 7. Data Vendor (`data-vendor`)
Data management and form libraries:
- `@tanstack/react-query` - Server state management
- `react-hook-form` & `@hookform/resolvers` - Form handling
- `zod` - Schema validation
- `web-push` - Push notification support

### 8. Utils Vendor (`utils-vendor`)
Date and utility libraries:
- `date-fns` - Date manipulation
- `react-day-picker` - Date picker component

### 9. Layout Vendor (`layout-vendor`)
Layout and interaction libraries:
- `react-router-dom` - Routing
- `react-grid-layout` - Grid layout system
- `react-resizable-panels` - Resizable panels
- `@hello-pangea/dnd` - Drag and drop
- `embla-carousel-react` - Carousel component

### 10. Canvas Vendor (`canvas-vendor`)
Canvas and visualization:
- `fabric` - Canvas manipulation library
- `recharts` - Chart/graph visualization

## Benefits

1. **Better Caching**: Each vendor chunk has a stable hash that only changes when its dependencies update
2. **Improved Loading**: Browser can download multiple chunks in parallel
3. **Optimized Bundle Size**: Logical grouping prevents duplicate code across chunks
4. **Performance**: Returning users get cache hits on unchanged vendor code

## Implementation

The configuration uses Vite's `build.rollupOptions.output.manualChunks` to define static chunk assignments. This approach provides predictable and optimal chunking for the project's specific dependency structure.