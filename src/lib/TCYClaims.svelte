<script>
  import { onMount } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';

  const claims = writable([]);
  const showMethodology = writable(false);
  const searchQuery = writable('');

  // Create a derived store for filtered claims
  const filteredClaims = derived(
    [claims, searchQuery],
    ([$claims, $searchQuery]) => {
      if (!$searchQuery) return $claims;
      const query = $searchQuery.toLowerCase();
      return $claims.filter(claim => 
        claim.address.toLowerCase().includes(query)
      );
    }
  );

  // Add a derived store for the total amount
  const totalAmount = derived(claims, $claims => 
    $claims.reduce((sum, claim) => sum + claim.amount, 0)
  );

  const methodologyText = {
    title: "TCY Claims Collector",
    description: "A Python script to collect and process TCY claim data for affected ThorFi users at node pause height 19562016.",
    codeLink: "https://replit.com/@Orion9R/TCY-Claim-Calculation-Process?v=1#main.py",
    dataSources: [
      {
        title: "Data Sources:",
        items: [
          {
            text: "ThorNode API",
            url: "https://thornode.ninerealms.com/",
            subItems: [
              "Pools data",
              "Savers positions",
              "Borrower positions"
            ]
          },
          {
            text: "Flipside API",
            url: "https://flipsidecrypto.xyz/api/v1/queries/29f988ed-34dd-44ea-8cb3-5eb74d94a705/data/latest",
            description: "(for outstanding synths)"
          }
        ]
      },
      {
        title: "Key Information:",
        items: [
          "Asset prices are taken from the node pause height",
          "Borrower positions are calculated as: (collateral_current * asset_price) - debt_current",
          "Node Pause Height: 19562016"
        ]
      }
    ]
  };

  onMount(async () => {
    try {
      const response = await fetch('/tcy_claims.json');
      const data = await response.json();
      
      // Process the data to use THOR address if present, otherwise L1Address
      const processedClaims = data.map(claim => ({
        address: claim.thor_address || claim.L1Address,
        amount: Number(claim.tcyClaim) / 1e8
      })).sort((a, b) => b.amount - a.amount); // Sort by amount descending
      
      claims.set(processedClaims);
    } catch (error) {
      console.error('Failed to fetch TCY claims:', error);
    }
  });

  function formatNumber(number) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number);
  }

  function flipScroll(node, { duration = 400, delay = 0 }) {
    return {
      delay,
      duration,
      css: (t, u) => {
        const eased = cubicOut(t);
        return `
          transform: rotateX(${90 * u}deg);
          transform-origin: center top;
          opacity: ${t};
          transform-style: preserve-3d;
          backface-visibility: hidden;
        `;
      }
    };
  }
</script>

<main>
  <div class="container">
    <div class="app-header">
      <h2>TCY Claims</h2>
      <div class="info-icon" on:click={() => showMethodology.update(v => !v)}>ⓘ</div>
    </div>

    {#if $showMethodology}
      <div class="methodology" in:flipScroll>
        <h3>{methodologyText.title}</h3>
        <p>{methodologyText.description}</p>
        <a href={methodologyText.codeLink} target="_blank" rel="noopener noreferrer" class="code-link">
          View Calculation Code
        </a>
        
        {#each methodologyText.dataSources as section}
          <div class="methodology-section">
            <h4>{section.title}</h4>
            <ul>
              {#each section.items as item}
                <li>
                  {#if item.url}
                    <a href={item.url} target="_blank" rel="noopener noreferrer" class="api-link">
                      {item.text}
                    </a>
                    {#if item.description}
                      {item.description}
                    {/if}
                    {#if item.subItems}
                      <ul class="sub-items">
                        {#each item.subItems as subItem}
                          <li>{subItem}</li>
                        {/each}
                      </ul>
                    {/if}
                  {:else}
                    {item}
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/each}

        <button class="close-button" on:click={() => showMethodology.set(false)}>Close</button>
      </div>
    {/if}

    <div class="total-amount">
      Total TCY: {formatNumber($totalAmount)}
    </div>

    <div class="search-container">
      <input 
        type="text" 
        placeholder="Search by address..." 
        bind:value={$searchQuery}
        class="search-input"
      />
    </div>

    {#if $claims.length > 0}
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th>TCY Claim Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each $filteredClaims as claim}
              <tr>
                <td class="address-cell">{claim.address}</td>
                <td class="amount-cell">{formatNumber(claim.amount)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="results-count">
        Showing {$filteredClaims.length} of {$claims.length} claims
      </div>
    {:else}
      <div class="loading">Loading claims data...</div>
    {/if}
  </div>
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
    color: #fff;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Exo 2', sans-serif;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 40px;
    gap: 15px;
    position: relative;
  }

  .app-header img {
    width: 40px;
    height: 40px;
  }

  .app-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #f8f8f8;
  }

  .info-icon {
    position: absolute;
    right: 0;
    background: none;
    border: none;
    color: #4A90E2;
    cursor: pointer;
    font-size: 18px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .info-icon:hover {
    opacity: 1;
  }

  .methodology {
    background: #2c2c2c;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    position: relative;
  }

  .methodology h3 {
    color: #4A90E2;
    margin: 0 0 15px 0;
  }

  .methodology p {
    margin: 0;
    line-height: 1.5;
  }

  .close-button {
    position: absolute;
    top: 15px;
    right: 15px;
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
  }

  .close-button:hover {
    color: #4A90E2;
  }

  .table-wrapper {
    background-color: #2c2c2c;
    border-radius: 12px;
    overflow-x: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background-color: #2c2c2c;
  }

  th {
    background-color: #1a1a1a;
    color: #888;
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid #3a3a3c;
  }

  tr {
    border-bottom: 1px solid #3a3a3c;
  }

  tr:last-child {
    border-bottom: none;
  }

  td {
    padding: 12px 16px;
    vertical-align: middle;
  }

  .address-cell {
    font-family: monospace;
    font-size: 14px;
  }

  .amount-cell {
    font-family: monospace;
    text-align: right;
  }

  .loading {
    text-align: center;
    color: #888;
    font-size: 18px;
    padding: 40px;
  }

  .search-container {
    margin-bottom: 20px;
  }

  .search-input {
    width: 100%;
    padding: 12px 16px;
    font-size: 16px;
    border: 1px solid #3a3a3c;
    border-radius: 8px;
    background-color: #2c2c2c;
    color: #fff;
    font-family: 'Exo 2', sans-serif;
  }

  .search-input:focus {
    outline: none;
    border-color: #4A90E2;
  }

  .search-input::placeholder {
    color: #888;
  }

  .results-count {
    margin-top: 10px;
    text-align: right;
    color: #888;
    font-size: 14px;
  }

  .total-amount {
    background: #2c2c2c;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    text-align: center;
    font-family: monospace;
    font-size: 18px;
    color: #4A90E2;
  }

  .methodology-section {
    margin-top: 20px;
  }

  .methodology-section h4 {
    color: #4A90E2;
    margin: 0 0 10px 0;
    font-size: 16px;
  }

  .methodology-section ul {
    margin: 0;
    padding-left: 20px;
    list-style-type: none;
  }

  .methodology-section li {
    margin-bottom: 8px;
    line-height: 1.4;
    color: #f8f8f8;
  }

  .methodology-section li:last-child {
    margin-bottom: 0;
  }

  .code-link {
    display: inline-block;
    margin: 15px 0;
    padding: 8px 16px;
    background-color: #4A90E2;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .code-link:hover {
    background-color: #357abd;
  }

  .api-link {
    color: #4A90E2;
    text-decoration: none;
    transition: color 0.2s;
  }

  .api-link:hover {
    color: #357abd;
    text-decoration: underline;
  }

  .sub-items {
    margin-top: 5px;
    margin-bottom: 0;
    padding-left: 20px;
  }

  .sub-items li {
    margin-bottom: 4px;
    color: #f8f8f8;
  }

  @media (max-width: 768px) {
    .container {
      padding: 10px;
    }

    .app-header h2 {
      font-size: 20px;
    }

    td, th {
      padding: 10px;
      font-size: 14px;
    }

    .address-cell {
      font-size: 12px;
      word-break: break-all;
    }

    .search-input {
      font-size: 14px;
      padding: 10px;
    }

    .total-amount {
      font-size: 16px;
      padding: 12px;
    }
  }
</style>
