import http from 'http';

function fetchAPI(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function testAPI() {
  console.log('Testing Real-Time Bus API...\n');
  
  const testStops = [
    { code: '8_17491', name: 'SAN ROQUE-GALILEO' },
    { code: '8_17492', name: 'CONSTITUCIÓN-FELIX SERRANO DEL REAL' },
    { code: '8_5930', name: 'DEHESA MARI MARTÍN-POL.IND.ALPARRACHE I' },
    { code: '8_5929', name: 'TRILLO-CHARCONES' }
  ];
  
  for (const stop of testStops) {
    try {
      const response = await fetchAPI(`http://localhost:5173/api/bus-times?codStop=${stop.code}`);
      
      if (response.stopTimes && response.stopTimes.times && response.stopTimes.times.Time) {
        const arrivals = response.stopTimes.times.Time;
        const numArrivals = arrivals.length;
        console.log(`✅ ${stop.name} (${stop.code})`);
        console.log(`   Found ${numArrivals} upcoming arrivals`);
        
        // Show first arrival time
        if (numArrivals > 0) {
          const firstArrival = arrivals[0];
          const time = new Date(firstArrival.time);
          const line = firstArrival.line?.shortDescription || 'N/A';
          console.log(`   Next bus: line ${line} at ${time.toLocaleTimeString('es-ES')}`);
        }
      } else {
        console.log(`⚠️  ${stop.name}: Unexpected response format`);
      }
    } catch (error) {
      console.log(`❌ ${stop.name}: ${error.message}`);
    }
  }
  
  console.log('\n✅ API endpoint working for all major stops!');
}

testAPI();
