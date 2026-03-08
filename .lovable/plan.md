

## Problem

The app crashes with:
```
[AppRoutes] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>
```

In `AppRouter.tsx`, `<AppRoutes />` is rendered as a React component inside `<Routes>`. React Router v7 strictly requires only `<Route>` or `<React.Fragment>` as direct children of `<Routes>`. A custom component wrapper (even if it returns a Fragment with Routes) is not allowed.

## Fix

In `src/router/AppRouter.tsx`, change `<AppRoutes />` to `{AppRoutes()}` so the Fragment is inlined directly rather than wrapped in a component element:

```tsx
<Routes>
  {AppRoutes()}
</Routes>
```

This is a one-line change. The `AppRoutes` function returns a `<>...</>` Fragment containing `<Route>` elements, which is valid when called directly but not when rendered as `<AppRoutes />`.

## Scope

- **1 file edited**: `src/router/AppRouter.tsx` (line 24)
- No other files need changes
- The localStorage/preference migration is unrelated and working correctly

