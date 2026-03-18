// Type augmentation for react-router-dom v7
// In v7, these are re-exported from 'react-router' but TypeScript may not resolve them.
// This declaration ensures they are available from 'react-router-dom'.
declare module 'react-router-dom' {
  export { 
    useNavigate, 
    useLocation, 
    useParams, 
    useSearchParams,
    Link,
    NavLink,
    Navigate,
    Outlet,
    Route,
    Routes,
    BrowserRouter,
    MemoryRouter,
    createBrowserRouter,
    RouterProvider,
  } from 'react-router';
}
