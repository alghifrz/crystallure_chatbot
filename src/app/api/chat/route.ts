import { NextRequest, NextResponse } from 'next/server';
import { GroqRAG } from '@/lib/groq-rag';
import { sessionManager, ConversationMessage } from '@/lib/session-manager';

// Initialize GroqRAG instance
let groqRAG: GroqRAG | null = null;

async function getGroqRAG() {
  if (!groqRAG) {
    const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    if (!PINECONE_API_KEY || !GROQ_API_KEY) {
      throw new Error('Missing API keys. Please set PINECONE_API_KEY and GROQ_API_KEY environment variables.');
    }
    
    groqRAG = new GroqRAG(PINECONE_API_KEY, GROQ_API_KEY);
    
    // Initialize the RAG system (load product names from Pinecone)
    try {
      await groqRAG.initialize();
    } catch (error) {
      console.warn('Could not initialize RAG system:', error);
      // Continue anyway, will use default product names
    }
  }
  return groqRAG;
}

export async function POST(request: NextRequest) {
  try {
    const { question, sessionId } = await request.json();
    
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
        { status: 400 }
      );
    }

    // Generate session ID if not provided
    const currentSessionId = sessionId || sessionManager.generateSessionId();
    
    const rag = await getGroqRAG();
    
    // Test Pinecone connection first
    const isConnected = await rag.test_pinecone_connection();
    if (!isConnected) {
      return NextResponse.json({
        answer: "Maaf, tidak dapat terhubung ke database Pinecone. Silakan coba lagi atau hubungi administrator.",
        productDetected: null,
        error: "Database connection failed"
      }, { status: 500 });
    }
    
    // Get conversation context
    const conversationContext = sessionManager.getConversationContext(currentSessionId);
    
    // Use the context-aware ask_question method
    const result = await rag.ask_question(question, conversationContext);
    
    // Store user message
    const userMessage: ConversationMessage = {
      id: `user_${Date.now()}`,
      timestamp: new Date(),
      type: 'user',
      content: question
    };
    sessionManager.addMessage(currentSessionId, userMessage);
    
    // Store assistant response
    const assistantMessage: ConversationMessage = {
      id: `assistant_${Date.now()}`,
      timestamp: new Date(),
      type: 'assistant',
      content: result.answer,
      productDetected: result.productDetected || undefined
    };
    sessionManager.addMessage(currentSessionId, assistantMessage);
    
    return NextResponse.json({
      answer: result.answer,
      productDetected: result.productDetected,
      totalMatches: result.totalMatches,
      sessionId: currentSessionId
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
