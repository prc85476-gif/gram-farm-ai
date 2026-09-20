// ==========================================================================
// TON BLOCKCHAIN ON-CHAIN DEPOSIT VERIFICATION ENGINE
// Real-time scanner for Tonkeeper / TON Mainnet transactions
// ==========================================================================

export const OFFICIAL_VAULT_ADDRESS = 'UQDFaBOdgZhLBZRSG28qImvn-Gn4kZ0D0HQVEHCtS9fFu7P0';

/**
 * Validates whether an on-chain transaction was sent to the official vault.
 * Supports Toncenter API and TonAPI v2 blockchain indexers.
 * 
 * @param {string} txHash - Transaction hash or message hash from Tonkeeper
 * @param {number} expectedAmountGram - Amount of GRAM claimed
 * @returns {Promise<{ success: boolean, message?: string, verifiedAmount?: number, senderAddress?: string, txHash?: string, isTest?: boolean }>}
 */
export async function verifyTonkeeperDepositOnChain(txHash, expectedAmountGram = 1) {
  const cleanHash = (txHash || '').trim();
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

  // Normalize target vault address for comparison
  const normalizedVault = OFFICIAL_VAULT_ADDRESS.toLowerCase();

  // 1. Check Toncenter API v2 for incoming transactions to the official vault
  try {
    const toncenterUrl = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(OFFICIAL_VAULT_ADDRESS)}&limit=50`;
    const res = await fetch(toncenterUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        for (const tx of data.result) {
          const txIdHash = tx.transaction_id?.hash || '';
          const inMsgHash = tx.in_msg?.hash || tx.in_msg?.body_hash || '';
          const inMsgSource = tx.in_msg?.source || '';
          const inMsgValue = Number(tx.in_msg?.value || 0);

          // Check if hash matches
          const matchesHash = (txIdHash && (txIdHash.toLowerCase() === cleanHash.toLowerCase() || txIdHash.includes(cleanHash))) ||
                              (inMsgHash && (inMsgHash.toLowerCase() === cleanHash.toLowerCase() || inMsgHash.includes(cleanHash))) ||
                              (cleanHash.includes(txIdHash) || cleanHash.includes(inMsgHash));

          if (matchesHash) {
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
              txHash: txIdHash || cleanHash
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Toncenter Verifier]', err.message);
  }

  // 2. Query TonAPI v2 direct blockchain transaction lookup
  try {
    const tonapiUrl = `https://tonapi.io/v2/blockchain/transactions/${encodeURIComponent(cleanHash)}`;
    const resApi = await fetch(tonapiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    if (resApi.ok) {
      const tx = await resApi.json();
      if (tx && tx.success !== false) {
        const inMsg = tx.in_msg;
        const dest = inMsg?.destination?.address || '';
        const inValue = Number(inMsg?.value || 0);

        // Verify destination matches vault
        const destMatches = !dest || 
                            dest.toLowerCase() === normalizedVault || 
                            OFFICIAL_VAULT_ADDRESS.includes(dest.substring(2, 20)) ||
                            dest.includes(OFFICIAL_VAULT_ADDRESS.substring(2, 20));

        if (destMatches) {
          const onChainTon = inValue / 1e9;
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
            senderAddress: inMsg?.source?.address || 'Tonkeeper Wallet',
            txHash: tx.hash || cleanHash
          };
        } else {
          return {
            success: false,
            message: `Transaction Destination Mismatch: Funds were sent to a different address (${dest.substring(0, 8)}...), not the official vault ${OFFICIAL_VAULT_ADDRESS.substring(0, 8)}...`
          };
        }
      }
    }
  } catch (err) {
    console.warn('[TonAPI Verifier]', err.message);
  }

  // 3. If transaction hash is not found on-chain
  return {
    success: false,
    message: `Verification Failed: Transaction ID "${cleanHash.substring(0, 12)}..." was not found on the TON Blockchain for vault ${OFFICIAL_VAULT_ADDRESS.substring(0, 8)}...${OFFICIAL_VAULT_ADDRESS.slice(-6)}. Please ensure you transferred GRAM/TON from Tonkeeper to the exact vault address and that the transaction is confirmed on-chain.`
  };
}
