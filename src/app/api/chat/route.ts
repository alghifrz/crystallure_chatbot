import { NextRequest, NextResponse } from 'next/server';
import { GroqRAG } from '@/lib/groq-rag';

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
    const { question } = await request.json();
    
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
        { status: 400 }
      );
    }

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
    
    // Use the new ask_question method
    const result = await rag.ask_question(question);
    
    return NextResponse.json({
      answer: result.answer,
      productDetected: result.productDetected,
      totalMatches: result.totalMatches
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
