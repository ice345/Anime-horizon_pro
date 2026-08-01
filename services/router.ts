export type AppRoute = 'guide' | 'record';

export const getRouteFromPath = (pathname: string): AppRoute => (pathname === '/archive' ? 'record' : 'guide');

export const getPathForRoute = (route: AppRoute) => (route === 'record' ? '/archive' : '/');

export const getCanonicalPath = (pathname: string) => getPathForRoute(getRouteFromPath(pathname));
