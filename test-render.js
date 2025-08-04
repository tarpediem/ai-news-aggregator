// Simple test to check if the app renders without infinite loops
const puppeteer = require('puppeteer');

async function testApp() {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`);
    });
    
    console.log('Navigating to app...');
    await page.goto('http://localhost:5174', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log('Waiting for app to load...');
    await page.waitForTimeout(5000);
    
    // Check if the main content loaded
    const hasContent = await page.$('[role="main"]') || await page.$('main');
    
    console.log('App loaded successfully:', !!hasContent);
    console.log('Console errors:', errors.length > 0 ? errors : 'None');
    
    if (errors.some(err => err.includes('Maximum update depth'))) {
      console.log('❌ Infinite loop detected');
      return false;
    } else {
      console.log('✅ No infinite loop detected');
      return true;
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testApp().then(success => {
  process.exit(success ? 0 : 1);
});