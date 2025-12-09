import { ProxyAgent } from "undici";

interface WebshareProxy {
  username: string;
  password: string;
  proxy_address: string;
  port: number;
}

interface WebshareResponse {
  results: WebshareProxy[];
}

let cachedProxies: WebshareProxy[] = [];
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchWebshareProxies(): Promise<WebshareProxy[]> {
  const apiKey = process.env.WEBSHARE_API_KEY;
  if (!apiKey) {
    throw new Error("WEBSHARE_API_KEY is required");
  }

  const now = Date.now();
  if (cachedProxies.length > 0 && now - lastFetch < CACHE_TTL) {
    return cachedProxies;
  }

  const response = await fetch(
    "https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=100",
    {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Webshare API error: ${response.status}`);
  }

  const data = (await response.json()) as WebshareResponse;
  cachedProxies = data.results;
  lastFetch = now;

  console.log(`Fetched ${cachedProxies.length} proxies from Webshare`);
  return cachedProxies;
}

export function getRandomProxy(proxies: WebshareProxy[]): WebshareProxy {
  return proxies[Math.floor(Math.random() * proxies.length)];
}

export function createProxyAgent(proxy: WebshareProxy): ProxyAgent {
  const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
  return new ProxyAgent(proxyUrl);
}

export async function fetchWithProxy(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = process.env.WEBSHARE_API_KEY;

  // If no API key or proxies fail, use direct fetch
  if (!apiKey) {
    console.log("No WEBSHARE_API_KEY, using direct fetch");
    return fetch(url, options);
  }

  try {
    const proxies = await fetchWebshareProxies();
    if (proxies.length === 0) {
      console.log("No proxies available, using direct fetch");
      return fetch(url, options);
    }

    const proxy = getRandomProxy(proxies);
    const agent = createProxyAgent(proxy);

    const { fetch: undiciFetch } = await import("undici");

    return undiciFetch(url, {
      ...options,
      dispatcher: agent,
    }) as unknown as Response;
  } catch (error) {
    console.log("Proxy error, falling back to direct fetch:", error);
    return fetch(url, options);
  }
}
