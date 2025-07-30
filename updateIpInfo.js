import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// THORChain API endpoints
const API_ENDPOINTS = {
  primary: 'https://thornode.thorchain.liquify.com',
  fallback: 'https://thornode.ninerealms.com'
};

// Helper function to make HTTP requests
const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
};

// Fetch data from API with automatic fallback
const fetchWithFallback = async (endpoint) => {
  const primaryUrl = `${API_ENDPOINTS.primary}${endpoint}`;
  const fallbackUrl = `${API_ENDPOINTS.fallback}${endpoint}`;
  
  try {
    console.log(`Trying primary endpoint: ${primaryUrl}`);
    const response = await makeRequest(primaryUrl);
    if (response.ok) {
      return response;
    }
    throw new Error(`Primary endpoint failed: ${response.status}`);
  } catch (error) {
    console.warn(`Primary endpoint failed, trying fallback: ${error.message}`);
    
    try {
      console.log(`Trying fallback endpoint: ${fallbackUrl}`);
      const fallbackResponse = await makeRequest(fallbackUrl);
      if (fallbackResponse.ok) {
        console.log(`Using fallback endpoint for: ${endpoint}`);
        return fallbackResponse;
      }
      throw new Error(`Fallback endpoint failed: ${fallbackResponse.status}`);
    } catch (fallbackError) {
      console.error(`Both endpoints failed for ${endpoint}:`, fallbackError);
      throw fallbackError;
    }
  }
};

// Fetch IP info from ip-api.com in batches
const fetchIpInfo = async (ips) => {
  const batchSize = 100; // ip-api.com allows up to 100 IPs per batch
  const results = {};
  
  // Split IPs into batches
  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize).map(ip => ({ query: ip }));
    
    console.log(`Fetching IP info for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(ips.length/batchSize)} (${batch.length} IPs)`);
    
    try {
      const response = await makeRequest('http://ip-api.com/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch)
      });

      if (!response.ok) {
        console.error(`Failed to fetch IP info batch: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      // Process results
      data.forEach((result, index) => {
        if (result.status === 'success') {
          const ip = batch[index].query;
          results[ip] = {
            isp: result.isp,
            countryCode: result.countryCode
          };
          console.log(`✅ ${ip}: ${result.isp} (${result.countryCode})`);
        } else {
          const ip = batch[index].query;
          console.log(`❌ ${ip}: ${result.message || 'Failed to get info'}`);
        }
      });
      
      // Be nice to the API - add a small delay between batches
      if (i + batchSize < ips.length) {
        console.log('Waiting 1 second before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error fetching IP info batch:', error);
    }
  }
  
  return results;
};

// Main function
const updateIpInfo = async () => {
  try {
    console.log('🚀 Starting IP info update...\n');
    
    // 1. Fetch current nodes from THORChain
    console.log('📡 Fetching nodes from THORChain...');
    const nodesResponse = await fetchWithFallback('/thorchain/nodes');
    const nodes = await nodesResponse.json();
    console.log(`Found ${nodes.length} nodes\n`);
    
    // 2. Extract unique IP addresses
    const allIps = [...new Set(nodes.map(node => node.ip_address).filter(ip => ip))];
    console.log(`Found ${allIps.length} unique IP addresses\n`);
    
    // 3. Load current ip-info.json
    const ipInfoPath = path.join(__dirname, 'public', 'ip-info.json');
    let currentIpInfo = {};
    
    if (fs.existsSync(ipInfoPath)) {
      console.log('📂 Loading existing ip-info.json...');
      const fileContent = fs.readFileSync(ipInfoPath, 'utf8');
      currentIpInfo = JSON.parse(fileContent);
      console.log(`Current file has ${Object.keys(currentIpInfo).length} IP entries\n`);
    } else {
      console.log('📂 No existing ip-info.json found, creating new file\n');
    }
    
    // 4. Find missing IPs
    const missingIps = allIps.filter(ip => !currentIpInfo[ip]);
    console.log(`Found ${missingIps.length} missing IP addresses:`);
    missingIps.forEach(ip => console.log(`  - ${ip}`));
    console.log('');
    
    if (missingIps.length === 0) {
      console.log('✅ All IP addresses are already in the database!');
      return;
    }
    
    // 5. Fetch IP info for missing IPs
    console.log('🔍 Fetching IP information from ip-api.com...\n');
    const newIpInfo = await fetchIpInfo(missingIps);
    
    // 6. Merge with existing data
    const updatedIpInfo = { ...currentIpInfo, ...newIpInfo };
    
    // 7. Sort the data by IP for better organization
    const sortedIpInfo = {};
    Object.keys(updatedIpInfo)
      .sort((a, b) => {
        // Sort IPs numerically
        const aNum = a.split('.').map(n => parseInt(n).toString().padStart(3, '0')).join('.');
        const bNum = b.split('.').map(n => parseInt(n).toString().padStart(3, '0')).join('.');
        return aNum.localeCompare(bNum);
      })
      .forEach(ip => {
        sortedIpInfo[ip] = updatedIpInfo[ip];
      });
    
    // 8. Write updated data to file
    console.log('\n💾 Updating ip-info.json...');
    fs.writeFileSync(ipInfoPath, JSON.stringify(sortedIpInfo, null, 2));
    
    console.log(`\n✅ Successfully updated ip-info.json!`);
    console.log(`📊 Statistics:`);
    console.log(`  - Total IPs in database: ${Object.keys(sortedIpInfo).length}`);
    console.log(`  - New IPs added: ${Object.keys(newIpInfo).length}`);
    console.log(`  - Successfully fetched: ${Object.keys(newIpInfo).filter(ip => newIpInfo[ip]).length}`);
    
  } catch (error) {
    console.error('❌ Error updating IP info:', error);
    process.exit(1);
  }
};

// Run the script
updateIpInfo(); 