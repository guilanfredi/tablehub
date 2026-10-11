/**
 * Identidade anônima do jogador, guardada no navegador.
 * Para testar vários jogadores no mesmo navegador, use `?perfil=2` na URL
 * (cada perfil tem seu próprio token/apelido).
 */
function profileSuffix(): string {
  try {
    const p = new URLSearchParams(location.search).get('perfil') ?? sessionStorage.getItem('th:perfil');
    if (p && /^[a-z0-9]{1,12}$/i.test(p)) {
      sessionStorage.setItem('th:perfil', p);
      return `:${p}`;
    }
  } catch {
    /* storage indisponível */
  }
  return '';
}

const mem = new Map<string, string>();
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return mem.get(key) ?? null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    mem.set(key, value);
  }
}

export function getToken(): string {
  const key = `th:token${profileSuffix()}`;
  let t = read(key);
  if (!t) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    t = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    write(key, t);
  }
  return t;
}

export function getName(): string {
  return read(`th:name${profileSuffix()}`) ?? '';
}

export function setName(name: string) {
  write(`th:name${profileSuffix()}`, name.trim());
}

export function profileQuery(): string {
  const s = profileSuffix();
  return s ? `?perfil=${s.slice(1)}` : '';
}
