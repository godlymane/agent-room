import puppeteer, { Browser, Page } from 'puppeteer';
import { logActivity } from '../db.js';
import { broadcast } from '../ws.js';

let browser: Browser | null = null;
let page: Page | null = null;

async function ensureBrowser(): Promise<Page> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.setDefaultNavigationTimeout(15000);
    page.setDefaultTimeout(10000);
  }
  return page;
}

// Capture and broadcast a screenshot to the frontend
async function broadcastScreenshot(p: Page) {
  try {
    const screenshot = await p.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
    const url = p.url();
    const title = await p.title();
    broadcast({
      type: 'activity',
      data: {
        id: `ss_${Date.now()}`,
        timestamp: Date.now(),
        type: 'action',
        message: `__BROWSER_FRAME__${screenshot}__URL__${url}__TITLE__${title}`,
        device: 'laptop',
      },
    });
  } catch {}
}

export async function handleBrowserTool(name: string, input: any): Promise<string> {
  try {
    const p = await ensureBrowser();

    if (name === 'browse_url') {
      await p.goto(input.url, { waitUntil: 'domcontentloaded' });
      const title = await p.title();
      // Stream screenshot to frontend
      await broadcastScreenshot(p);
      // Extract main text content
      const text = await p.evaluate(() => {
        const body = document.body.cloneNode(true) as HTMLElement;
        body.querySelectorAll('script, style, noscript, svg, iframe').forEach(s => s.remove());
        return body.innerText.slice(0, 3000);
      });
      logActivity({ type: 'action', message: `Browsed: ${title} (${input.url})`, device: 'laptop' });
      return `Page: ${title}\nURL: ${input.url}\n\nContent:\n${text}`;
    }

    if (name === 'browser_action') {
      switch (input.action) {
        case 'click':
          if (!input.selector) return 'Error: selector required for click';
          await p.click(input.selector);
          await new Promise(r => setTimeout(r, 500));
          await broadcastScreenshot(p);
          return `Clicked: ${input.selector}`;

        case 'type':
          if (!input.selector || !input.text) return 'Error: selector and text required';
          await p.type(input.selector, input.text);
          await broadcastScreenshot(p);
          return `Typed "${input.text}" into ${input.selector}`;

        case 'extract_text': {
          const text = await p.evaluate(() => document.body.innerText.slice(0, 3000));
          return text;
        }

        case 'get_links': {
          const links = await p.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]'))
              .slice(0, 30)
              .map(a => ({ text: (a as HTMLAnchorElement).innerText.trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
              .filter(l => l.text && l.href.startsWith('http'));
          });
          return links.map(l => `[${l.text}](${l.href})`).join('\n');
        }

        case 'screenshot': {
          await broadcastScreenshot(p);
          return `Screenshot sent to UI. Page: ${await p.title()}`;
        }

        default:
          return `Unknown browser action: ${input.action}`;
      }
    }

    return 'Unknown browser tool';
  } catch (error: any) {
    return `Browser error: ${error.message}`;
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}
