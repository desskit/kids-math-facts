// Hash router: '#/path/param?x=1'. GitHub Pages can't rewrite URLs, so
// every screen lives in the hash.

const routes = [];
let cleanup = null;
let container = null;
let onNavigate = null;

export function route(pattern, render, { tab } = {}) {
  const keys = [];
  const re = new RegExp(
    '^' + pattern.replace(/:[a-zA-Z]+/g, (m) => (keys.push(m.slice(1)), '([^/]+)')) + '/?$',
  );
  routes.push({ re, keys, render, tab });
}

export function navigate(path, { replace = false } = {}) {
  const hash = '#' + path;
  if (location.hash === hash) return render();
  if (replace) {
    history.replaceState(null, '', hash);
    render();
  } else {
    location.hash = hash;
  }
}

export function currentPath() {
  return (location.hash || '#/').slice(1) || '/';
}

async function render() {
  const full = currentPath();
  const [path, qs = ''] = full.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    if (cleanup) {
      try {
        cleanup();
      } catch (e) {
        console.error(e);
      }
      cleanup = null;
    }
    onNavigate && onNavigate(r.tab);
    container.replaceChildren();
    window.scrollTo(0, 0);
    try {
      const result = await r.render(container, params, query);
      if (typeof result === 'function') cleanup = result;
    } catch (e) {
      console.error(e);
      container.replaceChildren();
      const p = document.createElement('p');
      p.className = 'card';
      p.textContent = `Something went wrong: ${e.message}`;
      container.append(p);
    }
    return;
  }
  navigate('/', { replace: true });
}

export function startRouter(el, { onNav } = {}) {
  container = el;
  onNavigate = onNav;
  window.addEventListener('hashchange', render);
  render();
}
