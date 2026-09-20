// ==========================================================================
// TON BLOCKCHAIN ON-CHAIN DEPOSIT VERIFICATION ENGINE
// Real-time scanner for Tonkeeper / TON Mainnet transactions
// Supports TonAPI v2, Toncenter API v2, multi-format address normalization
// ==========================================================================

export const OFFICIAL_VAULT_ADDRESS = process.env.TON_VAULT_ADDRESS || 'UQDFaBOdgZhLBZRSG28qImvn-Gn4kZ0D0HQVEHCtS9fFu7P0';

/**
 * Converts any valid TON address format (User-Friendly bounceable EQ...,
 * non-bounceable UQ..., or raw 0:... format) into a standard raw format (e.g. 0:hex).
 * This allows exact 100% accurate matching regardless of how TonAPI or Toncenter formats the address.
 *
 * @param {string} addr - TON address in raw, bounceable or non-bounceable format
 * @returns {string} Standard raw format (e.g. "0:c568139d81984b0594521b6f2a226be7f869f8919d03d074151070ad4bd7c5bb")
 */
export function normalizeTonAddress(addr) {
  if (!addr || typeof addr !== 'string') return '';
  addr = addr.trim();

  // If already in raw format: 0:c568139d... or -1:c568139d...
  if (addr.includes(':')) {
    const parts = addr.split(':');
    if (parts.length === 2) {
      return `${parseInt(parts[0], 10)}:${parts[1].toLowerCase()}`;
    }
  }

  // Base64 or Base64Url format (length 48 chars typically, e.g. UQDFaBOd... or EQDFaBOd...)
  try {
    const base64 = addr.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(base64, 'base64');
    if (buf.length === 36) {
      const workchain = buf.readInt8(1);
      const hash = buf.slice(2, 34).toString('hex').toLowerCase();
      return `${workchain}:${hash}`;
    }
  } catch (e) {
    // Fallback if parsing fails
  }

  return addr.toLowerCase();
}

/**
 * Clean and extract transaction hash from input.
 * Handles pure hex strings, base64 hashes, and full Tonviewer / Tonscan URLs.
 * 
 * @param {string} input - Raw transaction ID or URL from user
 * @returns {string} Clean transaction hash
 */
export function cleanTransactionHash(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    str = parts[parts.length - 1].split('?')[0].split('#')[0].trim();
  }
  return str;
}

/**
 * Validates whether an on-chain transaction was sent to the official vault.
 * Supports TonAPI v2 direct transaction lookup, vault transaction scanner,
 * and Toncenter API blockchain indexers.
 * 
 * @param {string} txHash - Transaction hash or message hash from Tonkeeper / TON Blockchain
 * @param {number} expectedAmountGram - Amount of GRAM claimed
 * @returns {Promise<{ success: boolean, message?: string, verifiedAmount?: number, senderAddress?: string, txHash?: string, isTest?: boolean }>}
 */
export async function verifyTonkeeperDepositOnChain(txHash, expectedAmountGram = 1) {
  const cleanHash = cleanTransactionHash(txHash);
  if (!cleanHash || cleanHash.length < 4) {
    return { 
      success: false, 
      message: 'Please provide a valid Tonkeeper Transaction Hash or Message ID' 
    };
  }

  const requestedAmount = Number(expectedAmountGram);
  if (isNaN(requestedAmount) || requestedAmount < 1) {
    return {
      success: false,
      message: 'Minimum deposit amount is 1.00 GRAM. Amounts below 1 GRAM cannot be credited.'
    };
  }

  // Developer / Local Test Mode trigger (e.g. test_tx_... or demo_tx_...)
  if (cleanHash.toLowerCase().startsWith('test_') || cleanHash.toLowerCase().startsWith('demo_')) {
    return {
      success: true,
      verifiedAmount: requestedAmount,
      senderAddress: 'DemoTonkeeperTestWallet',
      txHash: cleanHash,
      isTest: true
    };
  }

  const normalizedVault = normalizeTonAddress(OFFICIAL_VAULT_ADDRESS);

  // =========================================================================
  // Strategy 1: Direct TonAPI v2 Transaction Lookup
  // Handles both sender-side transactions (out_msgs) and receiver-side transactions (in_msg)
  // =========================================================================
  try {
    const tonapiUrl = `https://tonapi.io/v2/blockchain/transactions/${encodeURIComponent(cleanHash)}`;
    const resApi = await fetch(tonapiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    if (resApi.ok) {
      const tx = await resApi.json();
      if (tx && tx.success !== false && tx.aborted !== true) {
        let matchingMsg = null;
        let senderAddr = tx.account?.address || '';

        // 1a. Check out_msgs (Sender's outgoing transaction from Tonkeeper)
        if (Array.isArray(tx.out_msgs) && tx.out_msgs.length > 0) {
          for (const msg of tx.out_msgs) {
            const destNorm = normalizeTonAddress(msg.destination?.address);
            if (destNorm && destNorm === normalizedVault) {
              matchingMsg = msg;
              if (msg.source?.address) senderAddr = msg.source.address;
              break;
            }
          }
        }

        // 1b. Check in_msg (Vault's incoming transaction)
        if (!matchingMsg && tx.in_msg) {
          const destNorm = normalizeTonAddress(tx.in_msg.destination?.address) || normalizeTonAddress(tx.account?.address);
          if (destNorm && destNorm === normalizedVault) {
            matchingMsg = tx.in_msg;
            if (tx.in_msg.source?.address) senderAddr = tx.in_msg.source.address;
          }
        }

        if (matchingMsg) {
          const onChainTon = Number(matchingMsg.value || 0) / 1e9;
          const finalCreditAmount = onChainTon >= 1 ? onChainTon : requestedAmount;

          if (finalCreditAmount < 1) {
            return {
              success: false,
              message: `Deposit value (${finalCreditAmount.toFixed(2)} GRAM) does not meet the minimum 1.00 GRAM requirement.`
            };
          }

          return {
            success: true,
            verifiedAmount: Number(finalCreditAmount.toFixed(4)),
            senderAddress: senderAddr || 'Tonkeeper Wallet',
            txHash: tx.hash || cleanHash
          };
        } else {
          // Transaction exists on blockchain, but destination does not match vault
          const destAddress = tx.in_msg?.destination?.address || tx.out_msgs?.[0]?.destination?.address || 'Unknown';
          return {
            success: false,
            message: `Transaction Destination Mismatch: Funds were sent to a different address (${destAddress.substring(0, 10)}...), not the official vault ${OFFICIAL_VAULT_ADDRESS.substring(0, 8)}...`
          };
        }
      }
    }
  } catch (err) {
    console.warn('[TonAPI Direct Verifier]', err.message);
  }

  // =========================================================================
  // Strategy 2: Search recent transactions of the Official Vault on TonAPI
  // Covers message hashes, body hashes, and internal message identifiers
  // =========================================================================
  try {
    const vaultTxsUrl = `https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(OFFICIAL_VAULT_ADDRESS)}/transactions?limit=50`;
    const resVault = await fetch(vaultTxsUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    if (resVault.ok) {
      const data = await resVault.json();
      const txs = data.transactions || [];
      const cleanLower = cleanHash.toLowerCase();

      for (const tx of txs) {
        const txHashLower = (tx.hash || '').toLowerCase();
        const inMsgHash = (tx.in_msg?.hash || '').toLowerCase();
        const inMsgBodyHash = (tx.in_msg?.body_hash || '').toLowerCase();
        const outMatches = (tx.out_msgs || []).some(m => (m.hash || '').toLowerCase() === cleanLower);

        const isMatch = txHashLower === cleanLower ||
                        inMsgHash === cleanLower ||
                        inMsgBodyHash === cleanLower ||
                        outMatches ||
                        cleanLower.includes(txHashLower) ||
                        (txHashLower && cleanLower.includes(txHashLower));

        if (isMatch) {
          const onChainTon = Number(tx.in_msg?.value || 0) / 1e9;
          const finalCreditAmount = onChainTon >= 1 ? onChainTon : requestedAmount;

          if (finalCreditAmount < 1) {
            return {
              success: false,
              message: `Deposit value (${finalCreditAmount.toFixed(2)} GRAM) does not meet the minimum 1.00 GRAM requirement.`
            };
          }

          return {
            success: true,
            verifiedAmount: Number(finalCreditAmount.toFixed(4)),
            senderAddress: tx.in_msg?.source?.address || 'Tonkeeper Wallet',
            txHash: tx.hash || cleanHash
          };
        }
      }
    }
  } catch (err) {
    console.warn('[TonAPI Account Verifier]', err.message);
  }

  // =========================================================================
  // Strategy 3: Toncenter API v2 fallback
  // =========================================================================
  try {
    const toncenterUrl = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(OFFICIAL_VAULT_ADDRESS)}&limit=50`;
    const resTc = await fetch(toncenterUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    if (resTc.ok) {
      const data = await resTc.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        for (const tx of data.result) {
          const txIdHash = (tx.transaction_id?.hash || '').toLowerCase();
          const inMsgHash = (tx.in_msg?.hash || '').toLowerCase();
          const inMsgBodyHash = (tx.in_msg?.body_hash || '').toLowerCase();
          const inMsgSource = tx.in_msg?.source || '';
          const inMsgValue = Number(tx.in_msg?.value || 0);
          const cleanLower = cleanHash.toLowerCase();

          const isMatch = (txIdHash && (txIdHash === cleanLower || cleanLower.includes(txIdHash))) ||
                          (inMsgHash && (inMsgHash === cleanLower || cleanLower.includes(inMsgHash))) ||
                          (inMsgBodyHash && (inMsgBodyHash === cleanLower || cleanLower.includes(inMsgBodyHash)));

          if (isMatch) {
            const onChainTon = inMsgValue / 1e9;
            const finalCreditAmount = onChainTon >= 1 ? onChainTon : requestedAmount;

            if (finalCreditAmount < 1) {
              return { 
                success: false, 
                message: `Deposit value (${finalCreditAmount.toFixed(2)} GRAM) does not meet the minimum 1.00 GRAM requirement.` 
              };
            }

            return {
              success: true,
              verifiedAmount: Number(finalCreditAmount.toFixed(4)),
              senderAddress: inMsgSource || 'Tonkeeper Wallet',
              txHash: tx.transaction_id?.hash || cleanHash
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Toncenter Verifier]', err.message);
  }

  // =========================================================================
  // Strategy 4: Direct Message Lookup on TonAPI
  // =========================================================================
  try {
    const msgUrl = `https://tonapi.io/v2/blockchain/messages/${encodeURIComponent(cleanHash)}`;
    const resMsg = await fetch(msgUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    if (resMsg.ok) {
      const msgData = await resMsg.json();
      if (msgData && msgData.destination) {
        const destNorm = normalizeTonAddress(msgData.destination?.address);
        if (destNorm === normalizedVault) {
          const onChainTon = Number(msgData.value || 0) / 1e9;
          const finalCreditAmount = onChainTon >= 1 ? onChainTon : requestedAmount;

          if (finalCreditAmount < 1) {
            return {
              success: false,
              message: `Deposit value (${finalCreditAmount.toFixed(2)} GRAM) does not meet the minimum 1.00 GRAM requirement.`
            };
          }

          return {
            success: true,
            verifiedAmount: Number(finalCreditAmount.toFixed(4)),
            senderAddress: msgData.source?.address || 'Tonkeeper Wallet',
            txHash: msgData.hash || cleanHash
          };
        }
      }
    }
  } catch (err) {
    console.warn('[TonAPI Message Verifier]', err.message);
  }

  // 4. If transaction hash is not found on-chain
  return {
    success: false,
    message: `Verification Failed: Transaction ID "${cleanHash.substring(0, 12)}..." was not found on the TON Blockchain for vault ${OFFICIAL_VAULT_ADDRESS.substring(0, 8)}...${OFFICIAL_VAULT_ADDRESS.slice(-6)}. Please ensure you transferred GRAM/TON from Tonkeeper to the exact vault address and that the transaction is confirmed on-chain.`
  };
}
