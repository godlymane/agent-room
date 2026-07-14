import { logActivity, logTransaction, getSetting, setSetting } from '../db.js';

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

// Persisted in the config table: paper trading is the rehearsal space for real Solana trading,
// so wiping the portfolio (and its P&L lessons) on every restart defeated its purpose.
const portfolio: PaperPortfolio = (() => {
  try {
    const raw = getSetting('paper_portfolio');
    if (raw) return JSON.parse(raw) as PaperPortfolio;
  } catch { /* corrupt state — fall through to a fresh portfolio */ }
  return {
    balance: 1000, // Start with $1000 paper money
    positions: [],
    tradeHistory: [],
  };
})();

function persistPortfolio() {
  setSetting('paper_portfolio', JSON.stringify(portfolio));
}

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
        persistPortfolio();
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
        persistPortfolio();

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
