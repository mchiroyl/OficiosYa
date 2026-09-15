import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const RouterContext = createContext(null);

export function Router({ children }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    if (to === window.location.pathname) return;
    if (options.replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }
    setPath(to);
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>
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
