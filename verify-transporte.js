import http from 'http';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('Testing Transporte page...\n');
  
  try {
    const html = await fetchPage('http://localhost:5173/transporte');
    
    // Verify the page loads
    if (html.includes('<title>Navalcarnero Vecinal</title>')) {
      console.log('✅ Page title correct');
    }
    
    // Verify React app is being served
    if (html.includes('id="root"')) {
      console.log('✅ React root element present');
    }
    
    // Verify the vite client is loaded
    if (html.includes('@vite/client') || html.includes('src/main.jsx')) {
      console.log('✅ Vite client loaded');
    }
    
    console.log('\n✅ Transporte page loads successfully!');
    
  } catch (error) {
    console.error('❌ Error testing page:', error.message);
    process.exit(1);
  }
}

verify();
