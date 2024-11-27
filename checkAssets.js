import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetLogos = {
  'BTC.BTC': 'assets/coins/bitcoin-btc-logo.svg',
  'ETH.ETH': 'assets/coins/ethereum-eth-logo.svg',
  // ... add all your asset paths here
};

Object.entries(assetLogos).forEach(([key, logoPath]) => {
  const fullPath = path.join(__dirname, 'public', logoPath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${key}: ${logoPath} exists`);
  } else {
    console.error(`❌ ${key}: ${logoPath} does not exist`);
  }
});