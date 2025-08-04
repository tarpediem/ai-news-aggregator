import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AINewsApp() {
  const [activeTab, setActiveTab] = useState<'news' | 'papers'>('news');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={`min-h-screen transition-colors ${isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900'}`}>
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="mb-8">
            <div className="bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      AI News Hub
                    </h1>
                    <p className="text-gray-600">Latest AI news and research papers</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {isDarkMode ? '☀️' : '🌙'}
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="bg-white/20 backdrop-blur-xl border border-white/20 rounded-xl p-4">
              <input
                type="text"
                placeholder="Search AI news..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-white/50 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="bg-white/20 backdrop-blur-xl border border-white/20 rounded-xl p-2 flex space-x-2">
              <button
                onClick={() => setActiveTab('news')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'news' 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-white/20'
                }`}
              >
                📰 News
              </button>
              <button
                onClick={() => setActiveTab('papers')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'papers' 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-white/20'
                }`}
              >
                📊 Research Papers
              </button>
            </div>
          </div>

          {/* Content Area */}
          <main>
            <div className="bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
              {activeTab === 'news' ? (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Latest AI News</h2>
                  <div className="space-y-4">
                    {[
                      { title: "OpenAI Releases GPT-4o", desc: "New model with advanced reasoning capabilities", time: "2 hours ago" },
                      { title: "Google Announces Gemini Ultra", desc: "Multimodal AI with unprecedented performance", time: "4 hours ago" },
                      { title: "Anthropic's Claude 3 Opus", desc: "Constitutional AI with enhanced safety features", time: "6 hours ago" }
                    ].filter(article => 
                      searchQuery === '' || 
                      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      article.desc.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map((article, index) => (
                      <div key={index} className="p-4 bg-white/30 rounded-lg border border-white/20">
                        <h3 className="font-semibold text-lg mb-2">{article.title}</h3>
                        <p className="text-gray-600 mb-2">{article.desc}</p>
                        <span className="text-sm text-gray-500">{article.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Research Papers</h2>
                  <div className="space-y-4">
                    {[
                      { title: "Attention Is All You Need", authors: "Vaswani et al.", venue: "NeurIPS 2017" },
                      { title: "BERT: Pre-training of Deep Bidirectional Transformers", authors: "Devlin et al.", venue: "NAACL 2019" },
                      { title: "GPT-3: Language Models are Few-Shot Learners", authors: "Brown et al.", venue: "NeurIPS 2020" }
                    ].filter(paper => 
                      searchQuery === '' || 
                      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      paper.authors.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map((paper, index) => (
                      <div key={index} className="p-4 bg-white/30 rounded-lg border border-white/20">
                        <h3 className="font-semibold text-lg mb-2">{paper.title}</h3>
                        <p className="text-gray-600 mb-1">Authors: {paper.authors}</p>
                        <span className="text-sm text-gray-500">{paper.venue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Footer */}
          <footer className="mt-8 text-center text-gray-500">
            <p>🚀 AI News Hub - Powered by Claude Code</p>
          </footer>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default AINewsApp;