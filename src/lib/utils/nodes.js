/**
 * THORChain Node Utilities
 *
 * Centralized utilities for fetching and processing node data
 * from THORChain. Handles node lookups, bond provider data,
 * operator grouping, consensus calculations, and status tracking.
 *
 * @module utils/nodes
 *
 * @example
 * // Get active nodes with metadata
 * import { fetchNodesWithMetadata } from '$lib/utils/nodes';
 *
 * const { nodes, activeCount, operatorGroups } = await fetchNodesWithMetadata();
 * console.log(`Active nodes: ${activeCount}`);
 *
 * @example
 * // Find bonds for specific addresses
 * import { getBondsForAddresses, calculateTotalBondValue } from '$lib/utils/nodes';
 *
 * const bonds = await getBondsForAddresses(addresses);
 * const totalUSD = calculateTotalBondValue(bonds, runePrice);
 * console.log(`Total bonded: $${totalUSD.toLocaleString()}`);
 */

import { thornode } from '../api/thornode.js';
import { midgard } from '../api/midgard.js';
import { fromBaseUnit } from './blockchain.js';
import { getAddressSuffix } from './formatting.js';

// ============================================
// Node Status Types
// ============================================

/**
 * Node status values
 * @constant {Object}
 */
export const NODE_STATUS = {
  ACTIVE: 'Active',
  STANDBY: 'Standby',
  READY: 'Ready',
  WHITELISTED: 'Whitelisted',
  DISABLED: 'Disabled',
  UNKNOWN: 'Unknown'
};

// ============================================
// Bond Fetching
// ============================================

/**
 * Fetch all nodes from THORNode
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<Object>>} Array of node objects
 */
export async function getNodes(options = {}) {
  return thornode.getNodes(options);
}

/**
 * Fetch bonds for specific addresses from all nodes
 *
 * Scans all nodes to find bond providers matching the given addresses.
 * Returns bond information including node address, amount, and status.
 *
 * @param {Array<string>} addresses - Array of bond provider addresses
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<Object>>} Array of bond objects
 *
 * @example
 * const treasuryAddresses = [
 *   'thor1abc...',
 *   'thor1def...'
 * ];
 *
 * const bonds = await getBondsForAddresses(treasuryAddresses);
 * // Returns:
 * // [
 * //   {
 * //     nodeAddress: 'thor1node...',
 * //     nodeSuffix: 'r304',
 * //     bondAddress: 'thor1abc...',
 * //     rawAmount: '88882053000000',
 * //     amount: 888820.53,
 * //     nodeStatus: 'Active'
 * //   },
 * //   ...
 * // ]
 */
export async function getBondsForAddresses(addresses, options = {}) {
  if (!addresses || addresses.length === 0) {
    return [];
  }

  const nodes = await getNodes(options);
  const bonds = [];

  // Create a Set for faster lookups (case-insensitive)
  const addressSet = new Set(addresses.map((a) => a.toLowerCase()));

  for (const node of nodes) {
    // Check if node has bond providers
    if (!node.bond_providers?.providers) {
      continue;
    }

    for (const provider of node.bond_providers.providers) {
      if (addressSet.has(provider.bond_address.toLowerCase())) {
        bonds.push({
          nodeAddress: node.node_address,
          nodeSuffix: getAddressSuffix(node.node_address, 4),
          bondAddress: provider.bond_address,
          rawAmount: provider.bond,
          amount: fromBaseUnit(provider.bond),
          nodeStatus: node.status || NODE_STATUS.UNKNOWN,
          nodePubKey: node.pub_key_set?.secp256k1 || null,
          nodeIpAddress: node.ip_address || null,
          nodeVersion: node.version || null
        });
      }
    }
  }

  return bonds;
}

/**
 * Fetch all bonds for a single address
 *
 * Convenience function to find all nodes where an address is a bond provider.
 *
 * @param {string} address - Bond provider address
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<Object>>} Array of bond objects
 *
 * @example
 * const myBonds = await getBondsForAddress('thor1abc...');
 * console.log(`You are bonding to ${myBonds.length} nodes`);
 */
export async function getBondsForAddress(address, options = {}) {
  if (!address) {
    return [];
  }
  return getBondsForAddresses([address], options);
}

/**
 * Get bond information for a specific node
 *
 * @param {string} nodeAddress - Node address
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Object|null>} Node bond info or null if not found
 *
 * @example
 * const nodeInfo = await getNodeBondInfo('thor1node...');
 * if (nodeInfo) {
 *   console.log(`Total bond: ${nodeInfo.totalBond.toLocaleString()} RUNE`);
 *   console.log(`Providers: ${nodeInfo.providers.length}`);
 * }
 */
export async function getNodeBondInfo(nodeAddress, options = {}) {
  if (!nodeAddress) return null;

  const nodes = await getNodes(options);
  const node = nodes.find(
    (n) => n.node_address.toLowerCase() === nodeAddress.toLowerCase()
  );

  if (!node) return null;

  const providers = (node.bond_providers?.providers || []).map((p) => ({
    address: p.bond_address,
    amount: fromBaseUnit(p.bond),
    rawAmount: p.bond
  }));

  const totalBond = providers.reduce((sum, p) => sum + p.amount, 0);

  return {
    nodeAddress: node.node_address,
    nodeSuffix: getAddressSuffix(node.node_address, 4),
    status: node.status,
    totalBond,
    providers,
    providerCount: providers.length,
    ipAddress: node.ip_address,
    version: node.version,
    slashPoints: node.slash_points || 0
  };
}

// ============================================
// Value Calculations
// ============================================

/**
 * Calculate total bond value in USD
 *
 * @param {Array<Object>} bonds - Array of bond objects from getBondsForAddresses
 * @param {number} runePrice - Current RUNE price in USD
 * @returns {number} Total USD value of all bonds
 *
 * @example
 * const bonds = await getBondsForAddresses(addresses);
 * const runePrice = 0.67;
 * const totalValue = calculateTotalBondValue(bonds, runePrice);
 * console.log(`Total bonded value: $${totalValue.toLocaleString()}`);
 */
export function calculateTotalBondValue(bonds, runePrice) {
  if (!bonds || bonds.length === 0 || !runePrice) return 0;

  return bonds.reduce((total, bond) => total + bond.amount * runePrice, 0);
}

/**
 * Calculate total RUNE amount bonded
 *
 * @param {Array<Object>} bonds - Array of bond objects
 * @returns {number} Total RUNE bonded
 */
export function calculateTotalBondAmount(bonds) {
  if (!bonds || bonds.length === 0) return 0;

  return bonds.reduce((total, bond) => total + bond.amount, 0);
}

/**
 * Get bond summary statistics
 *
 * @param {Array<Object>} bonds - Array of bond objects
 * @param {number} runePrice - Current RUNE price in USD
 * @returns {Object} Summary statistics
 *
 * @example
 * const summary = getBondSummary(bonds, 0.67);
 * console.log(`${summary.nodeCount} nodes, ${summary.totalRune.toLocaleString()} RUNE`);
 */
export function getBondSummary(bonds, runePrice = 0) {
  if (!bonds || bonds.length === 0) {
    return {
      bondCount: 0,
      nodeCount: 0,
      totalRune: 0,
      totalValueUSD: 0,
      averageBondRune: 0,
      averageBondUSD: 0,
      activeNodeCount: 0,
      standbyNodeCount: 0
    };
  }

  const uniqueNodes = new Set(bonds.map((b) => b.nodeAddress));
  const totalRune = calculateTotalBondAmount(bonds);
  const totalValueUSD = calculateTotalBondValue(bonds, runePrice);

  const activeNodeCount = bonds.filter((b) => b.nodeStatus === NODE_STATUS.ACTIVE).length;
  const standbyNodeCount = bonds.filter((b) => b.nodeStatus === NODE_STATUS.STANDBY).length;

  return {
    bondCount: bonds.length,
    nodeCount: uniqueNodes.size,
    totalRune,
    totalValueUSD,
    averageBondRune: totalRune / bonds.length,
    averageBondUSD: totalValueUSD / bonds.length,
    activeNodeCount,
    standbyNodeCount
  };
}

// ============================================
// Filtering and Sorting
// ============================================

/**
 * Filter bonds by node status
 *
 * @param {Array<Object>} bonds - Array of bond objects
 * @param {string|Array<string>} status - Status or array of statuses to include
 * @returns {Array<Object>} Filtered bonds
 *
 * @example
 * const activeBonds = filterBondsByStatus(bonds, NODE_STATUS.ACTIVE);
 * const activeOrStandby = filterBondsByStatus(bonds, [NODE_STATUS.ACTIVE, NODE_STATUS.STANDBY]);
 */
export function filterBondsByStatus(bonds, status) {
  if (!bonds) return [];

  const statuses = Array.isArray(status) ? status : [status];
  return bonds.filter((b) => statuses.includes(b.nodeStatus));
}

/**
 * Sort bonds by amount (descending by default)
 *
 * @param {Array<Object>} bonds - Array of bond objects
 * @param {boolean} [ascending=false] - Sort in ascending order
 * @returns {Array<Object>} Sorted bonds
 *
 * @example
 * const sortedBonds = sortBondsByAmount(bonds);
 * console.log(`Largest bond: ${sortedBonds[0].amount} RUNE`);
 */
export function sortBondsByAmount(bonds, ascending = false) {
  if (!bonds) return [];

  return [...bonds].sort((a, b) => {
    return ascending ? a.amount - b.amount : b.amount - a.amount;
  });
}

/**
 * Group bonds by node address
 *
 * @param {Array<Object>} bonds - Array of bond objects
 * @returns {Map<string, Array<Object>>} Map of node address to bonds array
 *
 * @example
 * const bondsByNode = groupBondsByNode(bonds);
 * for (const [nodeAddr, nodeBonds] of bondsByNode) {
 *   console.log(`Node ${nodeAddr}: ${nodeBonds.length} providers`);
 * }
 */
export function groupBondsByNode(bonds) {
  if (!bonds) return new Map();

  const grouped = new Map();

  for (const bond of bonds) {
    if (!grouped.has(bond.nodeAddress)) {
      grouped.set(bond.nodeAddress, []);
    }
    grouped.get(bond.nodeAddress).push(bond);
  }

  return grouped;
}

// ============================================
// Network Statistics
// ============================================

/**
 * Get network bond statistics
 *
 * Calculates aggregate bond statistics across all nodes.
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Object>} Network bond statistics
 *
 * @example
 * const stats = await getNetworkBondStats();
 * console.log(`Active nodes: ${stats.activeNodeCount}`);
 * console.log(`Total bonded: ${stats.totalBondedRune.toLocaleString()} RUNE`);
 */
export async function getNetworkBondStats(options = {}) {
  const nodes = await getNodes(options);

  let totalBondedRune = 0;
  let activeNodeCount = 0;
  let standbyNodeCount = 0;
  let totalProviders = 0;

  for (const node of nodes) {
    if (node.status === NODE_STATUS.ACTIVE) {
      activeNodeCount++;
    } else if (node.status === NODE_STATUS.STANDBY) {
      standbyNodeCount++;
    }

    if (node.bond_providers?.providers) {
      for (const provider of node.bond_providers.providers) {
        totalBondedRune += fromBaseUnit(provider.bond);
        totalProviders++;
      }
    }
  }

  return {
    totalNodes: nodes.length,
    activeNodeCount,
    standbyNodeCount,
    totalBondedRune,
    totalProviders,
    averageBondPerNode: totalBondedRune / nodes.length,
    averageProvidersPerNode: totalProviders / nodes.length
  };
}

// ============================================
// Churn Utilities
// ============================================

/**
 * Calculate the next churn timestamp
 *
 * Churning is when nodes rotate in/out of the active set.
 * The next churn time is: lastChurnTimestamp + (churnIntervalBlocks * 6 seconds)
 *
 * @param {number} lastChurnTimestamp - Unix timestamp of last churn (seconds)
 * @param {number} churnIntervalBlocks - Churn interval in blocks (from MIMIR)
 * @param {number} [blockTimeSeconds=6] - Seconds per block
 * @returns {number} Unix timestamp of next expected churn (seconds)
 *
 * @example
 * // Last churn was Jan 1, 2024, interval is 43200 blocks (~3 days)
 * const lastChurn = 1704067200; // Jan 1, 2024 00:00:00 UTC
 * const nextChurn = calculateNextChurnTime(lastChurn, 43200);
 * // => 1704326400 (Jan 4, 2024 00:00:00 UTC)
 */
export function calculateNextChurnTime(lastChurnTimestamp, churnIntervalBlocks, blockTimeSeconds = 6) {
  if (!lastChurnTimestamp || !churnIntervalBlocks) return 0;

  const churnIntervalSeconds = churnIntervalBlocks * blockTimeSeconds;
  return lastChurnTimestamp + churnIntervalSeconds;
}

/**
 * Calculate seconds remaining until next churn
 *
 * @param {number} lastChurnTimestamp - Unix timestamp of last churn (seconds)
 * @param {number} churnIntervalBlocks - Churn interval in blocks
 * @param {number} [blockTimeSeconds=6] - Seconds per block
 * @returns {number} Seconds remaining (0 if churn is overdue)
 *
 * @example
 * const secondsRemaining = getSecondsUntilChurn(lastChurn, 43200);
 * if (secondsRemaining > 0) {
 *   console.log(`Next churn in ${formatCountdown(secondsRemaining)}`);
 * } else {
 *   console.log('Churn is due now!');
 * }
 */
export function getSecondsUntilChurn(lastChurnTimestamp, churnIntervalBlocks, blockTimeSeconds = 6) {
  const nextChurn = calculateNextChurnTime(lastChurnTimestamp, churnIntervalBlocks, blockTimeSeconds);
  const now = Date.now() / 1000;

  return Math.max(0, nextChurn - now);
}

/**
 * Get comprehensive churn information
 *
 * Fetches MIMIR values and calculates all churn-related data.
 *
 * @param {number} lastChurnTimestamp - Unix timestamp of last churn
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Object>} Churn information object
 *
 * @example
 * const churnInfo = await getChurnInfo(lastChurnTimestamp);
 * console.log(`Next churn: ${new Date(churnInfo.nextChurnTimestamp * 1000)}`);
 * console.log(`Halted: ${churnInfo.isHalted}`);
 */
export async function getChurnInfo(lastChurnTimestamp, options = {}) {
  // Fetch churn-related MIMIR values
  const [churnIntervalText, haltChurningText] = await Promise.all([
    thornode.getMimir('CHURNINTERVAL', options).catch(() => '43200'), // Default ~3 days
    thornode.getMimir('HALTCHURNING', options).catch(() => '0')
  ]);

  const churnIntervalBlocks = Number(churnIntervalText);
  const isHalted = Number(haltChurningText) === 1;

  const nextChurnTimestamp = calculateNextChurnTime(lastChurnTimestamp, churnIntervalBlocks);
  const secondsRemaining = getSecondsUntilChurn(lastChurnTimestamp, churnIntervalBlocks);
  const isOverdue = secondsRemaining === 0 && !isHalted;

  return {
    lastChurnTimestamp,
    nextChurnTimestamp,
    churnIntervalBlocks,
    churnIntervalSeconds: churnIntervalBlocks * 6,
    secondsRemaining,
    isHalted,
    isOverdue
  };
}

/**
 * Calculate time since last churn in various units
 *
 * Useful for APY calculations that need to know the reward period.
 *
 * @param {number} lastChurnTimestamp - Unix timestamp of last churn (seconds)
 * @returns {Object} Time breakdown since last churn
 *
 * @example
 * const timeSince = getTimeSinceChurn(lastChurnTimestamp);
 * console.log(`Days since churn: ${timeSince.days.toFixed(2)}`);
 * console.log(`Use for APY: ${timeSince.years.toFixed(6)} years`);
 */
export function getTimeSinceChurn(lastChurnTimestamp) {
  const now = Date.now() / 1000;
  const secondsSince = now - lastChurnTimestamp;

  return {
    seconds: secondsSince,
    minutes: secondsSince / 60,
    hours: secondsSince / 3600,
    days: secondsSince / 86400,
    weeks: secondsSince / 604800,
    years: secondsSince / 31557600 // 365.25 days
  };
}

/**
 * Fetch recent churns from Midgard
 *
 * Returns an array of churn events with height, timestamp, and delta blocks.
 *
 * @param {number} [limit=10] - Maximum number of churns to return
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Array<Object>>} Array of churn objects
 *
 * @example
 * const churns = await getRecentChurns(5);
 * console.log(`Last churn at block ${churns[0].height}`);
 */
export async function getRecentChurns(limit = 10, options = {}) {
  const churns = await midgard.getChurns(options);

  if (!Array.isArray(churns) || churns.length === 0) {
    return [];
  }

  // Midgard returns latest first
  return churns.slice(0, limit).map((c, idx, arr) => {
    const height = Number(c.height);
    const timestampSec = Math.floor(Number(c.date) / 1e9);
    const next = arr[idx + 1];
    const prevHeight = next ? Number(next.height) : null;
    const deltaBlocks = prevHeight ? height - prevHeight : null;

    return {
      height,
      timestampSec,
      timestamp: new Date(timestampSec * 1000),
      deltaBlocks
    };
  });
}

/**
 * Get the most recent churn event
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Object|null>} Latest churn or null if none found
 *
 * @example
 * const lastChurn = await getLastChurn();
 * if (lastChurn) {
 *   console.log(`Last churn: block ${lastChurn.height} at ${lastChurn.timestamp}`);
 * }
 */
export async function getLastChurn(options = {}) {
  const churns = await getRecentChurns(1, options);
  return churns[0] || null;
}

// ============================================
// Node Filtering and Grouping
// ============================================

/**
 * Filter nodes by status
 *
 * @param {Array<Object>} nodes - Array of node objects
 * @param {string|Array<string>} status - Status or array of statuses to include
 * @returns {Array<Object>} Filtered nodes
 *
 * @example
 * const activeNodes = filterNodesByStatus(nodes, NODE_STATUS.ACTIVE);
 * const activeOrStandby = filterNodesByStatus(nodes, [NODE_STATUS.ACTIVE, NODE_STATUS.STANDBY]);
 */
export function filterNodesByStatus(nodes, status) {
  if (!nodes) return [];

  const statuses = Array.isArray(status) ? status : [status];
  return nodes.filter((n) => statuses.includes(n.status));
}

/**
 * Get active nodes from a node array
 *
 * @param {Array<Object>} nodes - Array of node objects
 * @returns {Array<Object>} Active nodes only
 *
 * @example
 * const nodes = await getNodes();
 * const activeNodes = getActiveNodes(nodes);
 */
export function getActiveNodes(nodes) {
  return filterNodesByStatus(nodes, NODE_STATUS.ACTIVE);
}

/**
 * Get active node addresses from a node array
 *
 * @param {Array<Object>} nodes - Array of node objects
 * @returns {Array<string>} Array of active node addresses
 *
 * @example
 * const nodes = await getNodes();
 * const activeAddresses = getActiveNodeAddresses(nodes);
 */
export function getActiveNodeAddresses(nodes) {
  return getActiveNodes(nodes).map((n) => n.node_address);
}

/**
 * Group nodes by their operator address
 *
 * @param {Array<Object>} nodes - Array of node objects
 * @returns {Object} Map of operator address to array of node addresses
 *
 * @example
 * const nodes = await getNodes();
 * const operatorGroups = groupNodesByOperator(nodes);
 * // { 'thor1abc...': ['thor1node1...', 'thor1node2...'], ... }
 */
export function groupNodesByOperator(nodes) {
  if (!nodes) return {};

  return nodes.reduce((acc, node) => {
    const operator = node.node_operator_address;
    if (!operator) return acc;

    if (!acc[operator]) {
      acc[operator] = [];
    }
    acc[operator].push(node.node_address);
    return acc;
  }, {});
}

/**
 * Calculate consensus threshold for governance votes
 *
 * THORChain requires 2/3 (66.67%) majority for governance changes.
 *
 * @param {number} activeCount - Number of active nodes
 * @param {number} [ratio=2/3] - Consensus ratio required (default: 2/3)
 * @returns {number} Number of votes needed for consensus
 *
 * @example
 * const votesNeeded = calculateConsensusThreshold(103); // => 69
 */
export function calculateConsensusThreshold(activeCount, ratio = 2 / 3) {
  if (!activeCount || activeCount <= 0) return 0;
  return Math.ceil(ratio * activeCount);
}

/**
 * Fetch nodes with commonly needed metadata
 *
 * Convenience function that returns nodes along with pre-computed
 * active node data, addresses, and operator groupings.
 *
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<Object>} Node data with metadata
 *
 * @example
 * const {
 *   nodes,
 *   activeNodes,
 *   activeCount,
 *   activeAddresses,
 *   operatorGroups,
 *   consensusThreshold
 * } = await fetchNodesWithMetadata();
 */
export async function fetchNodesWithMetadata(options = {}) {
  const nodes = await getNodes(options);

  const activeNodes = getActiveNodes(nodes);
  const activeCount = activeNodes.length;
  const activeAddresses = activeNodes.map((n) => n.node_address);
  const operatorGroups = groupNodesByOperator(nodes);
  const consensusThreshold = calculateConsensusThreshold(activeCount);

  return {
    nodes,
    activeNodes,
    activeCount,
    activeAddresses,
    operatorGroups,
    consensusThreshold,
    standbyCount: filterNodesByStatus(nodes, NODE_STATUS.STANDBY).length,
    totalCount: nodes.length
  };
}
