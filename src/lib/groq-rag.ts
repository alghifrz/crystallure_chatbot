import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { AnswerResult, SearchMatch } from './types';
import { EmbeddingService } from './services/embedding.service';
import { ProductService } from './services/product.service';
import { QueryService } from './services/query.service';
import { SearchService } from './services/search.service';
import { AnswerService } from './services/answer.service';

export class GroqRAG {
  private pc: Pinecone;
  private index: any;
  private groq_client: Groq;
  private namespace: string;
  
  // Services
  private embeddingService: EmbeddingService;
  private productService: ProductService;
  private queryService: QueryService;
  private searchService: SearchService;
  private answerService: AnswerService;

  constructor(pinecone_api_key: string, groq_api_key: string, namespace: string = "ns1") {
    this.pc = new Pinecone({ 
      apiKey: pinecone_api_key
    });
    this.index = this.pc.index("crystallure");
    this.groq_client = new Groq({ apiKey: groq_api_key });
    this.namespace = namespace;
    
    // Initialize services
    this.embeddingService = new EmbeddingService();
    this.productService = new ProductService();
    this.queryService = new QueryService();
    this.searchService = new SearchService(this.embeddingService, this.queryService);
    this.answerService = new AnswerService(this.groq_client, this.productService);
  }

  async initialize(): Promise<void> {
    // Load product names from Pinecone database
    await this.productService.loadProductNames(this.index, this.namespace);
    console.log("✅ Groq RAG siap digunakan!");
  }

  async test_pinecone_connection(): Promise<boolean> {
    try {
      console.log('🔍 Testing Pinecone connection...');
      const test_embedding = await this.embeddingService.get_embedding("test");
      const result = await this.index.namespace(this.namespace).query({
        vector: test_embedding,
        topK: 1,
        includeMetadata: true
      });
      console.log('✅ Pinecone connection successful');
      return true;
    } catch (error) {
      console.error('❌ Pinecone connection failed:', error);
      return false;
    }
  }

  async ask_question(question: string, conversationContext?: string): Promise<AnswerResult> {
    console.log('\n🔍 Analyzing question...');
    
    // Extract product name dari pertanyaan dengan context
    const product_name = this.productService.extract_product_name_with_context(question, conversationContext);
    
    if (product_name) {
      console.log(`✅ Detected product: '${product_name}'`);
      console.log(`🎯 Searching specific to this product...`);
    } else {
      console.log("ℹ️  No specific product detected, searching all products...");
    }
    
    // Search dengan product filter
    const matches = await this.searchService.search_pinecone(question, this.index, this.namespace, product_name);
    
    if (!matches || matches.length === 0) {
      console.log("❌ Tidak ada informasi relevan ditemukan.");
      return {
        answer: "Maaf, tidak ada informasi relevan ditemukan untuk pertanyaan Anda.",
        productDetected: product_name,
        totalMatches: 0
      };
    }
    
    console.log(`✅ Ditemukan ${matches.length} informasi relevan`);
    
    // Log detail matches untuk debug
    if (matches.length > 0) {
      console.log('📋 Detail matches:');
      for (let i = 0; i < Math.min(matches.length, 5); i++) {
        const match = matches[i];
        console.log(`  ${i+1}. Product: ${match.metadata?.product || 'Unknown'} | Section: ${match.metadata?.section || 'Unknown'} | Score: ${match.score?.toFixed(3) || 'N/A'}`);
      }
    }
    
    console.log('🤖 Generating jawaban...');
    
    const context = this.answerService.prepare_context(matches);
    const answer = await this.answerService.generate_answer_with_context(question, context, matches, conversationContext);
    
    return {
      answer,
      productDetected: product_name,
      totalMatches: matches.length,
      sources: matches.slice(0, 5) // Top 5 sources
    };
  }

  // Public methods untuk backward compatibility
  get_embedding(text: string): Promise<number[]> {
    return this.embeddingService.get_embedding(text);
  }

  normalize_query(text: string): string {
    return this.embeddingService.normalize_query(text);
  }

  expand_query(question: string): string[] {
    return this.queryService.expand_query(question);
  }

  extract_product_name(question: string): string | null {
    return this.productService.extract_product_name(question);
  }

  extract_product_name_with_context(question: string, conversationContext?: string): string | null {
    return this.productService.extract_product_name_with_context(question, conversationContext);
  }

  async search_pinecone(question: string, product_name?: string | null, top_k: number = 15): Promise<SearchMatch[]> {
    return this.searchService.search_pinecone(question, this.index, this.namespace, product_name, top_k);
  }

  prepare_context(matches: SearchMatch[]): string {
    return this.answerService.prepare_context(matches);
  }

  extract_direct_answer(question: string, matches: SearchMatch[]): string | null {
    return this.answerService.extract_direct_answer(question, matches);
  }

  extract_direct_answer_with_context(question: string, matches: SearchMatch[], conversationContext?: string): string | null {
    return this.answerService.extract_direct_answer_with_context(question, matches, conversationContext);
  }

  async generate_answer(question: string, context: string, matches: SearchMatch[]): Promise<string> {
    return this.answerService.generate_answer(question, context, matches);
  }

  async generate_answer_with_context(question: string, context: string, matches: SearchMatch[], conversationContext?: string): Promise<string> {
    return this.answerService.generate_answer_with_context(question, context, matches, conversationContext);
  }
}
