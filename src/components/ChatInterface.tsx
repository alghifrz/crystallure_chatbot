'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  productDetected?: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: inputValue.trim(),
          sessionId: sessionId 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Store session ID from first response
      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: data.answer,
        timestamp: new Date(),
        productDetected: data.productDetected
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Silakan coba lagi.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Jika belum ada pesan, tampilkan welcome screen
  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-screen bg-gradient-to-br from-white via-yellow-50/30 to-orange-50/20">
        {/* Header - Minimal Navbar */}
        <div className="bg-white/90 backdrop-blur-sm border-b border-gray-100 p-4 shadow-sm h-20">
          <div className="max-w-6xl mx-auto flex items-center justify-between h-full">
            {/* Left Side - Logo */}
            <div className="flex items-center">
              <div className="relative w-64 h-64 cursor-pointer">
                <Image
                  src="/logo.png"
                  alt="Crystallure Logo"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            
            {/* Right Side - Icon */}
            <div className="flex items-center">
              <div className="relative w-10 h-10 group">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Image
                  src="/icon.png"
                  alt="Crystallure Icon"
                  fill
                  className="object-contain hover:scale-110 transition-all duration-300 cursor-pointer relative z-10"
                  onClick={() => window.open('https://www.crystallurebeauty.com/', '_blank')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-4xl mx-auto text-center">
                {/* Main Question */}
                <h2 className="text-5xl font-bold text-gray-900 mb-4">
                  Ada yang bisa saya bantu?
                </h2>
              
              <p className="text-xl text-gray-600 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
                Tanyakan apapun tentang produk Crystallure 
              </p>

            {/* Chat Input - Large Input Box */}
            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Tanyakan apapun"
                  className="w-full px-6 py-5 text-lg border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 transition-all duration-300 placeholder-gray-400 font-light bg-white/80 shadow-sm backdrop-blur-sm"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                
                {/* Submit Button - Inside Input */}
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl hover:from-yellow-600 hover:to-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-sm"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Bottom Info Box */}
              <div className="mt-4 bg-white/60 rounded-xl p-4 border border-gray-100 backdrop-blur-sm">
                <p className="text-sm text-gray-500 font-light text-center">
                  AI bisa salah. Silakan periksa kembali jawaban untuk akurasi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat Interface
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-white via-yellow-50/30 to-orange-50/20">
      {/* Header - Minimal Navbar */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-100 p-4 shadow-sm h-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-full">
          {/* Left Side - Logo */}
          <div className="flex items-center">
            <div className="relative w-32 h-32 cursor-pointer">
              <Image
                src="/logo.png"
                alt="Crystallure Logo"
                fill
                className="object-contain"
              />
            </div>
          </div>
          
          {/* Right Side - Icon */}
          <div className="flex items-center">
            <div className="relative w-10 h-10 group">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Image
                src="/icon.png"
                alt="Crystallure Icon"
                fill
                className="object-contain hover:scale-110 transition-all duration-300 cursor-pointer relative z-10"
                onClick={() => window.open('https://www.crystallurebeauty.com/', '_blank')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-3xl p-4 mb-8 ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white shadow-lg'
                    : 'bg-white text-gray-800 shadow-xl border border-gray-200/50'
                }`}
              >
                <div className="whitespace-pre-wrap font-light leading-relaxed">{message.content}</div>
                <div className={`text-xs mt-3 text-right ${
                  message.type === 'user' ? 'text-yellow-100' : 'text-gray-400'
                }`}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-800 shadow-xl border border-gray-200/50 rounded-3xl p-6">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-500 border-t-transparent"></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white/80 backdrop-blur-sm border-t border-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tanyakan apapun"
              className="w-full px-6 py-4 text-lg border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 transition-all duration-300 placeholder-gray-400 font-light bg-white/80 shadow-sm backdrop-blur-sm"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            {/* Submit Button - Inside Input */}
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl hover:from-yellow-600 hover:to-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-sm"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
