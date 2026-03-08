import crypto from 'crypto';
import { logActivity, logTransaction } from '../db.js';

// === Real Binance API (when enabled) ===
const BINANCE_KEY = process.env.BINANCE_API_KEY || '';
const BINANCE_SECRET = process.env.BINANCE_SECRET || '';
const USE_REAL = process.env.BINANCE_REAL === 'true' && BINANCE_KEY && BINANCE_SECRET;
const BINANCE_BASE = USE_REAL ? 'https://api.binance.com' : 'https://testnet.binance.vision';

async function binanceSigned(endpoint: string, params: Record<string, string> = {}, method = 'GET') {
  if (!BINANCE_KEY || !BINANCE_SECRET) return { error: 'Binance API keys not configured' };
  const timestamp = Date.now().toString();
  const queryString = new URLSearchParams({ ...params, timestamp }).toString();
  const signature = crypto.createHmac('sha256', BINANCE_SECRET).update(queryString).digest('hex');
  const url = `${BINANCE_BASE}${endpoint}?${queryString}&signature=${signature}`;
  const res = await fetch(url, {
    method,
    headers: { 'X-MBX-APIKEY': BINANCE_KEY },
  });
  return res.json();
}

// Paper trading state (in-memory, could persist to DB)
interface Position {
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  amount: number;
  timestamp: number;
}

interface PaperPortfolio {
  balance: number;
  positions: Position[];
  tradeHistory: Array<{
    symbol: string;
    side: string;
    amount: number;
    price: number;
    pnl: number;
    timestamp: number;
  }>;
}

const portfolio: PaperPortfolio = {
  balance: 1000, // Start with $1000 paper money
  positions: [],
  tradeHistory: [],
};

// Fetch real market data from public APIs (no key needed)
async function getPrice(symbol: string): Promise<{ price: number; change24h: number; volume: number } | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      price: parseFloat(data.lastPrice),
      change24h: parseFloat(data.priceChangePercent),
      volume: parseFloat(data.quoteVolume),
    };
  } catch {
    return null;
  }
}

async function getKlines(symbol: string, interval: string = '1h', limit: number = 20) {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.map((k: any[]) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch {
    return null;
  }
}

export async function handleCryptoTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'crypto_check_market': {
      const symbol = input.symbol?.toUpperCase() || 'BTCUSDT';
      const ticker = await getPrice(symbol);
      if (!ticker) return `Could not fetch data for ${symbol}`;

      const klines = await getKlines(symbol, input.timeframe || '1h', 20);
      let analysis = '';
      if (klines && klines.length > 1) {
        const prices = klines.map((k: any) => k.close);
        const sma = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
        const trend = prices[prices.length - 1] > sma ? 'ABOVE' : 'BELOW';
        const volatility = ((Math.max(...prices) - Math.min(...prices)) / sma * 100).toFixed(2);
        analysis = `\nSMA(${prices.length}): $${sma.toFixed(2)} (price is ${trend} SMA)\nVolatility: ${volatility}%`;
      }

      logActivity({ type: 'action', message: `Checked ${symbol}: $${ticker.price}`, device: 'dashboard' });
      return `${symbol}\nPrice: $${ticker.price}\n24h Change: ${ticker.change24h > 0 ? '+' : ''}${ticker.change24h.toFixed(2)}%\nVolume: $${(ticker.volume / 1e6).toFixed(1)}M${analysis}`;
    }

    case 'crypto_real_balance': {
      if (!USE_REAL) return 'Real trading not enabled. Set BINANCE_REAL=true and provide API keys in .env';
      const data = await binanceSigned('/api/v3/account');
      if (data.error) return data.error;
      const nonZero = (data.balances || []).filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
      return `Real Binance Balance:\n${nonZero.map((b: any) => `  ${b.asset}: ${b.free} (locked: ${b.locked})`).join('\n') || '  Empty'}`;
    }

    case 'crypto_real_trade': {
      if (!USE_REAL) return 'Real trading not enabled. Set BINANCE_REAL=true in .env';
      const symbol = input.symbol?.toUpperCase();
      const side = input.side?.toUpperCase();
      const quoteAmount = input.amount;
      if (!symbol || !side || !quoteAmount) return 'Need symbol, side, and amount';

      // Market order using quoteOrderQty (spend exact USDT amount)
      const result = await binanceSigned('/api/v3/order', {
        symbol, side, type: 'MARKET',
        quoteOrderQty: quoteAmount.toString(),
      }, 'POST');

      if (result.code) return `Binance error: ${result.msg}`;

      const filled = result.executedQty;
      const cost = result.cummulativeQuoteQty;
      logTransaction({ type: side === 'BUY' ? 'expense' : 'earning', amount: parseFloat(cost), description: `Real ${side} ${symbol}: ${filled} @ market`, module: 'crypto' });
      logActivity({ type: side === 'BUY' ? 'action' : 'earning', message: `REAL ${side} ${symbol}: ${filled} for $${cost}`, device: 'dashboard' });
      return `REAL ${side} executed:\nSymbol: ${symbol}\nFilled: ${filled}\nCost: $${cost}\nStatus: ${result.status}`;
    }

    case 'crypto_trade': {
      const symbol = input.symbol?.toUpperCase() || 'BTCUSDT';
      const side = input.side;
      const amount = input.amount;

      if (amount > portfolio.balance && side === 'buy') {
        return `Insufficient paper balance. Have: $${portfolio.balance.toFixed(2)}, Need: $${amount}`;
      }

      const ticker = await getPrice(symbol);
      if (!ticker) return `Could not fetch price for ${symbol}`;

      if (side === 'buy') {
        portfolio.balance -= amount;
        portfolio.positions.push({
          symbol,
          side: 'long',
          entryPrice: ticker.price,
          amount,
          timestamp: Date.now(),
        });
        logActivity({ type: 'action', message: `Paper BUY ${symbol} $${amount} @ $${ticker.price}`, device: 'dashboard' });
        return `Paper BUY executed: ${symbol} $${amount} @ $${ticker.price}\nRemaining balance: $${portfolio.balance.toFixed(2)}`;
      } else {
        // Close a long position
        const posIdx = portfolio.positions.findIndex(p => p.symbol === symbol);
        if (posIdx === -1) {
          return `No open position in ${symbol} to sell`;
        }
        const pos = portfolio.positions[posIdx];
        const pnl = (ticker.price - pos.entryPrice) / pos.entryPrice * pos.amount;
        portfolio.balance += pos.amount + pnl;
        portfolio.tradeHistory.push({
          symbol, side: 'sell', amount: pos.amount, price: ticker.price, pnl, timestamp: Date.now(),
        });
        portfolio.positions.splice(posIdx, 1);

        // If profit, log as earning
        if (pnl > 0) {
          logTransaction({ type: 'earning', amount: pnl, description: `Paper trade profit: ${symbol}`, module: 'crypto' });
          logActivity({ type: 'earning', message: `Paper PROFIT on ${symbol}: +$${pnl.toFixed(2)}`, device: 'dashboard' });
        } else {
          logActivity({ type: 'action', message: `Paper LOSS on ${symbol}: -$${Math.abs(pnl).toFixed(2)}`, device: 'dashboard' });
        }

        return `Paper SELL executed: ${symbol} $${pos.amount} @ $${ticker.price}\nP&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}\nBalance: $${portfolio.balance.toFixed(2)}`;
      }
    }

    case 'crypto_portfolio': {
      const positionsStr = portfolio.positions.length > 0
        ? portfolio.positions.map(p => {
            return `  ${p.symbol}: $${p.amount} @ $${p.entryPrice} (${p.side})`;
          }).join('\n')
        : '  No open positions';

      const historyStr = portfolio.tradeHistory.slice(-5).map(t =>
        `  ${t.side.toUpperCase()} ${t.symbol}: $${t.amount} → P&L: ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}`
      ).join('\n') || '  No trade history';

      return `Paper Trading Portfolio\nBalance: $${portfolio.balance.toFixed(2)}\n\nOpen Positions:\n${positionsStr}\n\nRecent Trades:\n${historyStr}`;
    }

    default:
      return `Unknown crypto tool: ${name}`;
  }
}
