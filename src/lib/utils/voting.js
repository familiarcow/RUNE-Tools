/**
 * THORChain Voting/Mimir Utilities
 *
 * Shared functions for mimir governance voting components.
 * Handles fetching and processing node mimir votes.
 *
 * @module utils/voting
 *
 * @example
 * // Get votes for a specific mimir key
 * import { getMimirVotesForKey } from '$lib/utils/voting';
 *
 * const votes = await getMimirVotesForKey('SOL-RPC-PROVIDER');
 * // Returns Map<nodeAddress, voteValue>
 *
 * @example
 * // Get color for a vote option
 * import { getColorForVote } from '$lib/utils/voting';
 *
 * const color = getColorForVote(false, 1, 'QuickNode');
 * // Returns hex color based on ranking
 */

import { fetchJSONWithFallback } from './api';
import { getAddressSuffix } from './formatting';

// ============================================
// Constants
// ============================================

/**
 * Mimir keys to exclude from general voting display
 * These are old/deprecated/test keys that clutter the UI
 * @constant {Array<string>}
 */
export const MIMIR_KEY_BLACKLIST = [
  'HALTRADING', 'STOP-NEW-SAVERS', 'ADR012', 'ADR18', 'ADR013',
  'ALTGAIACHAIN', 'BAREMETALBADASS', 'BSCREADY', 'DEPRECATEILP',
  'ELROND', 'ENABLEAVAXCHAIN', 'ENABLEBSC', 'ENABLEDASHCHAIN',
  'ENABLEDOFM', 'ENABLEUPDATEMEMOTERRA', 'FULLIMPLOSSPROTECTIONBLOCKS',
  'KILLSWITCHSTART', 'L1MINSLIPBPS', 'MAXBONDPROVIDES', 'MAXRUNESUPPLY',
  'MULTIPARTITEFORPRESIDENT', 'NEXTCHAIN', 'NEXTFEATUREPERPRS',
  'NEXTFEATUREPERPS', 'RAGNAROK-BNB-AVA-645', 'RAGNAROK-BNB-BAT-07A',
  'RAGNAROK-BNB-BNB', 'RAGNAROK-BNB-BTCB-1DE', 'RAGNAROK-BNB-BUSD-BD1',
  'RAGNAROK-BNB-CAKE-435', 'RAGNAROK-BNB-EQL-586', 'RAGNAROK-BNB-ETH-1C9',
  'RAGNAROK-BNB-ETHBULL-D33', 'RAGNAROK-BNB-NEXO-A84', 'RAGNAROK-BNB-RUNE',
  'RAGNAROK-BNB-TWT-8C2', 'RAGNAROK-BNB-USDT-6D8', 'RAGNAROK-BNB-XRP-BF2',
  'RAGNAROK-TERRA', 'RAGNAROK-TERRA-LUNA', 'RAGNAROK-TERRA-USD',
  'RAGNAROK-TERRA-UST', 'RAGNAROK-BSC', 'REMOVESNXPOOL',
  'SUPPORTTHORCHAINDOTNETWORK', 'TEST', 'THISISANEWMIMIR', 'VOTEDOFM',
  'VOTELENDING', 'VOTEMAXBONDPROVIDERS', 'VOTEMAXSYNTHSFORSAVERSYIELD',
  'VOTESTREAMINGSWAPS', 'ENABLEVAXCHAIN', 'MAXSYNTHPERASSETDEPTH',
  'MINIMUM1OUTBOUNDFEEUSD', 'RAGNAROKBSC', 'VALIDATORMAXREWARDRATIO',
  'NODEOPERATORFEE', 'MINBPAFFILIATEFEERATE', 'ENABLESAVINGSVAULTS',
  'SYSTEMINCOMEBURNRATEBP', '9RPROPOSAL', 'AALUXXFORPRESIDENT',
  'ADD-CHAIN-BASE', 'LENDING-THOR-BTC', 'LENDING-THOR-ETH',
  'LENDING-THOR-LTC', 'PROPOSAL2', 'PROPOSAL6', 'PROPOSAL8'
];

/**
 * Color palette for vote visualization (20 distinct colors)
 * Used to visually differentiate different vote options
 * @constant {Array<string>}
 */
export const VOTE_COLOR_PALETTE = [
  '#3498db', // Blue
  '#9b59b6', // Purple
  '#e84393', // Pink
  '#e67e22', // Orange
  '#e74c3c', // Red
  '#f1c40f', // Yellow
  '#1abc9c', // Turquoise
  '#16a085', // Dark Turquoise
  '#27ae60', // Dark Green
  '#2980b9', // Dark Blue
  '#8e44ad', // Dark Purple
  '#c0392b', // Dark Red
  '#d35400', // Dark Orange
  '#00a8ff', // Light Blue
  '#9c88ff', // Light Purple
  '#ffa502', // Light Orange
  '#ff6b6b', // Light Red
  '#4cd137', // Lime
  '#00d2d3', // Cyan
  '#a8e6cf'  // Mint
];

// ============================================
// Data Fetching
// ============================================

/**
 * Fetch all mimir node votes from THORNode
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<{key: string, value: string, signer: string}>>} Array of mimir vote objects
 *
 * @example
 * const mimirs = await fetchMimirNodeVotes();
 * console.log(`Total votes: ${mimirs.length}`);
 */
export async function fetchMimirNodeVotes(options = {}) {
  const data = await fetchJSONWithFallback('/thorchain/mimir/nodes_all', options);
  return data.mimirs || [];
}

/**
 * Get current mimir values (passed/active values)
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Object>} Map of key -> current value
 *
 * @example
 * const mimirValues = await getCurrentMimirValues();
 * console.log(`Min bond: ${mimirValues.MINIMUMBONDINRUNE}`);
 */
export async function getCurrentMimirValues(options = {}) {
  return await fetchJSONWithFallback('/thorchain/mimir', options);
}

/**
 * Get votes for a specific mimir key
 *
 * Filters all node mimir votes to return only those for the specified key.
 * Returns a Map for efficient lookups by node address.
 *
 * @param {string} key - Mimir key to filter for (e.g., 'SOL-RPC-PROVIDER')
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Map<string, number>>} Map of node address -> vote value
 *
 * @example
 * const votes = await getMimirVotesForKey('SOL-RPC-PROVIDER');
 * console.log(`Nodes with votes: ${votes.size}`);
 *
 * // Check a specific node's vote
 * const vote = votes.get('thor1abc...');
 * if (vote) console.log(`Node voted for provider: ${vote}`);
 */
export async function getMimirVotesForKey(key, options = {}) {
  const mimirs = await fetchMimirNodeVotes(options);
  const votes = new Map();

  for (const mimir of mimirs) {
    if (mimir.key === key) {
      votes.set(mimir.signer, parseInt(mimir.value));
    }
  }

  return votes;
}

// ============================================
// Vote Processing
// ============================================

/**
 * Group mimir votes by key and value
 *
 * @param {Array} mimirData - Raw mimir array from API
 * @param {Array} [activeNodeAddresses=[]] - Array of active node addresses to filter by
 * @param {Array} [keyBlacklist=[]] - Keys to exclude
 * @returns {Object} Grouped votes: { key: { value: [signers] } }
 *
 * @example
 * const grouped = groupVotesByKey(mimirData, activeAddresses, MIMIR_KEY_BLACKLIST);
 * // { 'MINTSYNTHS': { '1': ['thor1abc...', 'thor1def...'], '0': ['thor1xyz...'] } }
 */
export function groupVotesByKey(mimirData, activeNodeAddresses = [], keyBlacklist = []) {
  const grouped = {};

  for (const mimir of mimirData) {
    if (keyBlacklist.includes(mimir.key)) continue;
    if (activeNodeAddresses.length > 0 && !activeNodeAddresses.includes(mimir.signer)) continue;

    if (!grouped[mimir.key]) grouped[mimir.key] = {};
    if (!grouped[mimir.key][mimir.value]) grouped[mimir.key][mimir.value] = [];
    grouped[mimir.key][mimir.value].push(mimir.signer);
  }

  return grouped;
}

/**
 * Normalize vote options for display with ranking and sorting
 *
 * Takes raw vote data and produces a sorted array suitable for display:
 * - Passed (active) values come first
 * - Then sorted by vote count (most votes first)
 * - "Not Voted" always comes last
 * - Each option gets a popularity rank for coloring
 *
 * @param {string} key - Mimir key
 * @param {Object} valueMap - Map of value -> array of signers
 * @param {*} currentMimirValue - Current active value for this key (if any)
 * @param {Array<string>} activeNodeAddresses - All active node addresses
 * @returns {Array<Object>} Sorted array of vote option objects
 *
 * @example
 * const options = normalizeVoteOptions('MINTSYNTHS', {'1': ['a', 'b'], '0': ['c']}, 1, allAddresses);
 * // Returns:
 * // [
 * //   { value: '1', count: 2, signers: ['a', 'b'], isPassed: true, popularityRank: 0 },
 * //   { value: '0', count: 1, signers: ['c'], isPassed: false, popularityRank: 1 },
 * //   { value: 'Not Voted', count: 97, signers: [...], isPassed: false, popularityRank: 2 }
 * // ]
 */
export function normalizeVoteOptions(key, valueMap, currentMimirValue, activeNodeAddresses) {
  const totalVotes = Object.values(valueMap).reduce((sum, signers) => sum + signers.length, 0);

  const options = Object.entries(valueMap).map(([value, signers]) => ({
    value: value === 'undefined' || value === '' ? 'No Vote' : value,
    count: signers.length,
    signers: signers.map(signer => getAddressSuffix(signer, 4)),
    fullSigners: signers,
    isPassed: currentMimirValue === parseInt(value),
    totalVotes
  }));

  // Combine all "No Vote" entries
  const noVoteEntry = options.find(entry => entry.value === 'No Vote');
  const otherVotes = options.filter(entry => entry.value !== 'No Vote');

  // Find nodes that haven't voted
  const votedAddresses = Object.values(valueMap).flat();
  const noVoteSigners = activeNodeAddresses.filter(address =>
    !votedAddresses.includes(address)
  );

  // Add "Not Voted" option if there are non-voters
  if (noVoteEntry || noVoteSigners.length > 0) {
    const combinedNoVote = {
      value: 'Not Voted',
      count: (noVoteEntry ? noVoteEntry.count : 0) + noVoteSigners.length,
      signers: [
        ...(noVoteEntry ? noVoteEntry.signers : []),
        ...noVoteSigners.map(signer => getAddressSuffix(signer, 4))
      ],
      fullSigners: [
        ...(noVoteEntry ? noVoteEntry.fullSigners : []),
        ...noVoteSigners
      ],
      isPassed: false,
      totalVotes: totalVotes + noVoteSigners.length
    };
    otherVotes.push(combinedNoVote);
  }

  // Sort with passed values first, then by vote count, and "Not Voted" last
  otherVotes.sort((a, b) => {
    // Always put "Not Voted" at the bottom
    if (a.value === 'Not Voted') return 1;
    if (b.value === 'Not Voted') return -1;

    // Then sort by passed status
    if (a.isPassed !== b.isPassed) {
      return b.isPassed ? 1 : -1; // Passed values go first
    }

    // Finally sort by vote count
    return b.count - a.count;
  });

  // Assign popularity ranks after sorting
  let rank = 1;
  otherVotes.forEach((option, index) => {
    if (index > 0 && option.count < otherVotes[index - 1].count) {
      rank++;
    }
    option.popularityRank = option.isPassed ? 0 : rank;
  });

  return otherVotes;
}

// ============================================
// Visualization
// ============================================

/**
 * Get color for a vote option
 *
 * @param {boolean} isPassed - Is this the active/passed value
 * @param {number} popularityRank - Rank by vote count (1 = most votes)
 * @param {string} value - The vote value (for special handling of "Not Voted")
 * @returns {string} Hex color code
 *
 * @example
 * getColorForVote(true, 0, '1');        // => '#2ecc71' (green for passed)
 * getColorForVote(false, 1, '0');       // => '#3498db' (first palette color)
 * getColorForVote(false, 0, 'Not Voted'); // => '#95a5a6' (grey)
 */
export function getColorForVote(isPassed, popularityRank, value) {
  if (isPassed) return '#2ecc71'; // Green for passed votes
  if (value === 'Not Voted') return '#95a5a6'; // Grey for not voted

  // Use modulo to cycle through colors if we have more ranks than colors
  return VOTE_COLOR_PALETTE[(popularityRank - 1) % VOTE_COLOR_PALETTE.length];
}

/**
 * Calculate vote statistics for a mimir key
 *
 * @param {Map<string, number>} votes - Map of node address -> vote value
 * @param {Array<string>} activeNodeAddresses - All active node addresses
 * @returns {Object} Vote statistics
 *
 * @example
 * const stats = calculateVoteStats(votes, activeAddresses);
 * console.log(`${stats.votedCount}/${stats.totalNodes} nodes have voted (${stats.votedPercentage}%)`);
 */
export function calculateVoteStats(votes, activeNodeAddresses) {
  const totalNodes = activeNodeAddresses.length;
  const votedCount = activeNodeAddresses.filter(addr => votes.has(addr)).length;
  const notVotedCount = totalNodes - votedCount;

  return {
    totalNodes,
    votedCount,
    notVotedCount,
    votedPercentage: totalNodes > 0 ? ((votedCount / totalNodes) * 100).toFixed(1) : '0',
    notVotedPercentage: totalNodes > 0 ? ((notVotedCount / totalNodes) * 100).toFixed(1) : '0'
  };
}

/**
 * Group votes by value and count them
 *
 * @param {Map<string, number>} votes - Map of node address -> vote value
 * @param {Array<string>} [activeNodeAddresses=[]] - Filter to only active nodes
 * @returns {Map<number, Array<string>>} Map of vote value -> array of node addresses
 *
 * @example
 * const byValue = groupVotesByValue(votes, activeAddresses);
 * for (const [value, nodes] of byValue) {
 *   console.log(`Value ${value}: ${nodes.length} votes`);
 * }
 */
export function groupVotesByValue(votes, activeNodeAddresses = []) {
  const grouped = new Map();

  for (const [nodeAddress, value] of votes) {
    // If active addresses provided, filter to only those
    if (activeNodeAddresses.length > 0 && !activeNodeAddresses.includes(nodeAddress)) {
      continue;
    }

    if (!grouped.has(value)) {
      grouped.set(value, []);
    }
    grouped.get(value).push(nodeAddress);
  }

  return grouped;
}
