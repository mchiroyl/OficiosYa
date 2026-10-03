import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const RouterContext = createContext(null);

function currentPathname() {
  return window.location.pathname;
}

function currentSearch() {
  return window.location.search || '';
}

export function Router({ children }) {
  const [path, setPath] = useState(currentPathname);
  const [search, setSearch] = useState(currentSearch);

  useEffect(() => {
    const onPopState = () => {
      setPath(currentPathname());
      setSearch(currentSearch());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    const url = new URL(to, window.location.origin);
    const nextPath = url.pathname;
    const nextSearch = url.search || '';
    const nextHash = url.hash || '';
    const full = `${nextPath}${nextSearch}${nextHash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (full === current && !options.replace) return;

    if (options.replace) {
      window.history.replaceState({}, '', full);
    } else {
      window.history.pushState({}, '', full);
    }
    setPath(nextPath);
    setSearch(nextSearch);
  }, []);

  return (
    <RouterContext.Provider value={{ path, search, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter debe usarse dentro de <Router>');
  }
  return ctx;
}

export function usePath() {
  return useRouter().path;
}

export function useSearch() {
  return useRouter().search;
}

export function useNavigate() {
  return useRouter().navigate;
}

/** Match `/workers/:id` style patterns against the current pathname. */
export function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};

  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i];
    const value = pathParts[i];

    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) {
      return null;
    }
  }

  return params;
}

export function useParams(pattern) {
  const path = usePath();
  return matchPath(pattern, path) ?? {};
}

export function Link({ to, children, className, onClick, ...rest }) {
  const { navigate } = useRouter();

  const handleClick = (e) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.altKey ||
      e.ctrlKey ||
      e.shiftKey
    ) {
      return;
    }
    e.preventDefault();
    onClick?.(e);
    navigate(to);
  };

  return (
    <a href={to} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
