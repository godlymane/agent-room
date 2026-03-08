import { logActivity } from '../db.js';

const GUMROAD_API = 'https://api.gumroad.com/v2';

function getToken(): string {
  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) throw new Error('GUMROAD_ACCESS_TOKEN not set in .env');
  return token;
}

async function gumroadAPI(endpoint: string, method = 'GET', body?: Record<string, any>): Promise<any> {
  const url = `${GUMROAD_API}${endpoint}`;

  // Gumroad uses form-encoded POST, not JSON
  const headers: Record<string, string> = {};
  let fetchBody: any;

  if (method === 'GET') {
    // For GET, append access_token as query param
    const sep = endpoint.includes('?') ? '&' : '?';
    const fullUrl = `${url}${sep}access_token=${getToken()}`;
    const res = await fetch(fullUrl, { method, headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(`Gumroad API ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return data;
  }

  // POST — form-encoded
  const params = new URLSearchParams();
  params.set('access_token', getToken());
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(`Gumroad API ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

export async function handleGumroadTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'gumroad_create_product': {
      const { name: prodName, description, price, url: customUrl } = input;
      if (!prodName) return 'Error: name required';

      try {
        const data = await gumroadAPI('/products', 'POST', {
          name: prodName,
          description: description || `A useful tool built by AI. Download and use instantly.`,
          price: Math.round((price || 100)), // cents
          preview_url: customUrl || undefined,
        });

        const product = data.product;
        const productUrl = product.short_url || product.permalink;
        logActivity({ type: 'earning', message: `Listed on Gumroad: ${prodName} ($${(price || 100) / 100}) ${productUrl}`, device: 'laptop' });
        return `Product created!\nName: ${product.name}\nPrice: $${(product.price / 100).toFixed(2)}\nURL: ${productUrl}\nID: ${product.id}`;
      } catch (e: any) {
        return `Gumroad error: ${e.message}`;
      }
    }

    case 'gumroad_list_products': {
      try {
        const data = await gumroadAPI('/products');
        const products = data.products;
        if (!products || products.length === 0) return 'No products listed yet.';
        return products.map((p: any) =>
          `${p.name} - $${(p.price / 100).toFixed(2)} (${p.sales_count || 0} sales, $${((p.sales_usd_cents || 0) / 100).toFixed(2)} earned) ${p.short_url}`
        ).join('\n');
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }

    default:
      return `Unknown gumroad tool: ${name}`;
  }
}
