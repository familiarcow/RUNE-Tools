const THOR_RUNE_ASSET = {
  chain: 'THOR',
  symbol: 'RUNE',
  ticker: 'RUNE'
};

function normalizeWalletError(error, fallbackMessage) {
  if (!error) return new Error(fallbackMessage);
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error(error.message || fallbackMessage);
}

function extractTxHash(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;

  return (
    result.hash ||
    result.txHash ||
    result.tx_hash ||
    result.transactionHash ||
    result.txid ||
    ''
  );
}

function normalizeAccounts(result) {
  if (!result) return [];

  if (Array.isArray(result)) {
    return result.filter((item) => typeof item === 'string');
  }

  if (Array.isArray(result.accounts)) {
    return result.accounts.filter((item) => typeof item === 'string');
  }

  if (typeof result.address === 'string') {
    return [result.address];
  }

  return [];
}

async function providerRequest(provider, payload) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(normalizeWalletError(error, 'Wallet request failed'));
        return;
      }
      resolve(value);
    };

    try {
      const maybePromise = provider.request(payload, (error, value) => finish(error, value));

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then((value) => finish(null, value)).catch((error) => finish(error));
      } else if (maybePromise !== undefined) {
        Promise.resolve().then(() => finish(null, maybePromise));
      }
    } catch (error) {
      finish(error);
    }
  });
}

export function getThorProvider() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window?.xfi?.thorchain || null;
}

export function hasThorProvider() {
  return Boolean(getThorProvider());
}

export async function requestAccounts() {
  const provider = getThorProvider();
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('THOR wallet provider not found');
  }

  const result = await providerRequest(provider, {
    method: 'request_accounts'
  });

  const accounts = normalizeAccounts(result);
  if (accounts.length === 0) {
    throw new Error('No THOR wallet accounts returned');
  }

  return accounts;
}

export async function depositThorTx(params) {
  const provider = getThorProvider();
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('THOR wallet provider not found');
  }

  const amountBase = Number(params.amountBase);
  if (!Number.isFinite(amountBase) || amountBase < 0) {
    throw new Error('Invalid transaction amount');
  }

  if (!params.from || !params.recipient || !params.memo) {
    throw new Error('Missing deposit transaction fields');
  }

  const txParams = {
    asset: THOR_RUNE_ASSET,
    from: params.from,
    recipient: params.recipient,
    amount: {
      amount: String(Math.trunc(amountBase)),
      decimals: 8
    },
    memo: params.memo
  };

  const result = await providerRequest(provider, {
    method: 'deposit',
    params: [txParams]
  });

  return {
    result,
    txHash: extractTxHash(result)
  };
}
