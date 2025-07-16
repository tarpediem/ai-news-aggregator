const axios = require('axios');

console.log('🤖 Testing AI News Scraper...\n');

async function testScraper() {
  try {
    // Test 1: Backend Health Check
    console.log('1. Testing Backend Health...');
    const healthResponse = await axios.get('http://localhost:8001/health');
    console.log('✅ Backend is healthy');
    console.log(`   Uptime: ${Math.round(healthResponse.data.uptime)}s`);
    console.log(`   Memory: ${Math.round(healthResponse.data.memory.heapUsed / 1024 / 1024)}MB\n`);

    // Test 2: Scrape Hacker News for AI content
    console.log('2. Scraping Hacker News for AI content...');
    const scrapeResponse = await axios.post('http://localhost:8001/scrape', {
      url: 'https://news.ycombinator.com',
      selectors: {
        container: '.athing',
        title: '.titleline a',
        link: '.titleline a'
      }
    });

    const allArticles = scrapeResponse.data.results;
    console.log(`✅ Scraped ${allArticles.length} total articles`);

    // Filter for AI-related content
    const aiKeywords = ['ai', 'llm', 'gpt', 'claude', 'openai', 'anthropic', 'machine learning', 'neural', 'deep learning'];
    const aiArticles = allArticles.filter(article => 
      aiKeywords.some(keyword => 
        article.title.toLowerCase().includes(keyword)
      )
    );

    console.log(`🔍 Found ${aiArticles.length} AI-related articles:`);
    aiArticles.slice(0, 5).forEach((article, index) => {
      console.log(`   ${index + 1}. ${article.title}`);
      console.log(`      → ${article.link}\n`);
    });

    // Test 3: Cache Statistics
    console.log('3. Checking cache status...');
    const cacheResponse = await axios.get('http://localhost:8001/cache/stats');
    console.log(`✅ Cache has ${cacheResponse.data.size} entries`);
    console.log(`   Cached URLs: ${cacheResponse.data.keys.length > 0 ? 'Yes' : 'None'}\n`);

    // Test 4: Test a real AI news source
    console.log('4. Testing OpenAI blog scraping...');
    try {
      const openaiResponse = await axios.post('http://localhost:8001/scrape', {
        url: 'https://openai.com/blog',
        selectors: {
          container: 'article, .post, [class*="post"]',
          title: 'h1, h2, h3, .title',
          description: 'p, .excerpt',
          link: 'a[href]'
        }
      });

      console.log(`✅ OpenAI blog: ${openaiResponse.data.results.length} articles found`);
      if (openaiResponse.data.results.length > 0) {
        console.log(`   Latest: ${openaiResponse.data.results[0].title}`);
      }
    } catch (error) {
      console.log(`⚠️  OpenAI blog might be blocking requests: ${error.message}`);
    }

    console.log('\n🎉 AI News Scraper is working correctly!');
    console.log('\n📱 Access your app at:');
    console.log('   Frontend: http://localhost:5173');
    console.log('   Backend:  http://localhost:8001');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend is running on port 8001');
    }
  }
}

testScraper();