import { SearchMatch, AnswerResult } from '../types';
import Groq from 'groq-sdk';
import { ProductService } from './product.service';

export class AnswerService {
  constructor(private groq_client: Groq, private productService?: ProductService) {}

  prepare_context(matches: SearchMatch[]): string {
    const context_parts: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const text = match.metadata?.chunk_text || '';
      const product = match.metadata?.product || 'Unknown';
      const section = match.metadata?.section || 'General';
      context_parts.push(`[INFO ${i + 1}] Product: ${product} | Section: ${section}\n${text}`);
    }
    return context_parts.join('\n\n');
  }

  handleProductListQuestion(matches: SearchMatch[]): string {
    // For product list questions, use all available products from ProductService
    let productList: string[] = [];
    
    if (this.productService) {
      // Use all products from ProductService, excluding general 'Crystallure'
      const allProducts = this.productService.getProductNames();
      productList = allProducts.filter(p => p !== 'Crystallure').sort();
      console.log(`📋 Using all ${productList.length} products from ProductService`);
    } else {
      // Fallback: Extract unique product names from matches
      const productNames = new Set<string>();
      
      for (const match of matches) {
        const product = match.metadata?.product;
        if (product && product !== 'Crystallure') { // Exclude general 'Crystallure'
          productNames.add(product);
        }
      }
      
      productList = Array.from(productNames).sort();
      console.log(`📋 Fallback: Found ${productList.length} unique products from matches`);
    }
    
    console.log(`📋 Final product list:`, productList);
    
    if (productList.length === 0) {
      return "Maaf, tidak ada informasi produk yang tersedia.";
    }
    
    let response = `Berikut adalah daftar produk dari Crystallure yang tersedia:\n\n`;
    productList.forEach((product, index) => {
      response += `${index + 1}. ${product}\n`;
    });
    
    return response;
  }

  extract_direct_answer(question: string, matches: SearchMatch[]): string | null {
    // Sederhanakan: biarkan Groq LLM yang memahami konteks secara natural
    // Hanya return null agar selalu menggunakan LLM untuk jawaban
    return null;
  }

  extract_direct_answer_with_context(question: string, matches: SearchMatch[], conversationContext?: string): string | null {
    // Untuk pertanyaan spesifik tentang teknologi/kandungan, JANGAN gunakan context
    const q_lower = question.toLowerCase();
    const is_specific_search = ['mengandung', 'kandungan', 'ingredient', 'komposisi', 'bahan', 'apa yang mengandung', 'yang dilengkapi', 'yang menggunakan', 'teknologi'].some(word => q_lower.includes(word));
    
    if (is_specific_search) {
      console.log(`🔍 Specific search detected - skipping context for direct answer extraction`);
      return this.extract_direct_answer(question, matches);
    }
    
    // Extract current product from context
    let currentProduct: string | null = null;
    if (conversationContext) {
      const contextLines = conversationContext.split('\n');
      for (const line of contextLines) {
        if (line.includes('Produk yang sedang dibicarakan:')) {
          currentProduct = line.replace('Produk yang sedang dibicarakan:', '').trim();
          break;
        }
      }
    }
    
    // Filter matches to only include current product if context is available
    let filteredMatches = matches;
    if (currentProduct && currentProduct !== 'null') {
      filteredMatches = matches.filter(match => 
        match.metadata?.product === currentProduct
      );
      console.log(`🔍 Filtering matches for product: ${currentProduct}, found ${filteredMatches.length} matches`);
    }
    
    // Use filtered matches for direct answer extraction
    return this.extract_direct_answer(question, filteredMatches);
  }

  async generate_answer(question: string, context: string, matches: SearchMatch[]): Promise<string> {
    // Handle product list questions specially
    const q_lower = question.toLowerCase();
    
    // More specific detection for product list questions
    const is_product_list_question = (
      // Direct product list questions
      (q_lower.includes('apa aja') && (q_lower.includes('produk') || q_lower.includes('crystallure'))) ||
      q_lower.includes('produk apa') ||
      q_lower.includes('daftar produk') ||
      q_lower.includes('semua produk') ||
      q_lower.includes('produk dari') ||
      q_lower.includes('produk crystallure') ||
      // Questions that explicitly ask for product listing
      (q_lower.includes('produk') && q_lower.includes('crystallure') && !q_lower.includes('ingredient') && !q_lower.includes('kandungan') && !q_lower.includes('cara'))
    );
    
    if (is_product_list_question) {
      console.log(`📋 Product list question detected: "${question}"`);
      return this.handleProductListQuestion(matches);
    }
    
    // Coba extract jawaban langsung dulu
    const direct_answer = this.extract_direct_answer(question, matches);
    if (direct_answer) {
      return direct_answer;
    }
    
    // Jika tidak bisa extract langsung, pakai LLM
    const prompt = `Jawab pertanyaan berdasarkan informasi di bawah. PENTING: Baca semua informasi dengan teliti!

INFORMASI:
${context}

PERTANYAAN: ${question}

INSTRUKSI:
- Cari angka/nilai yang tepat (ml, gram, gr, g, Rp, %, dll)
- Jika ada angka di awal kalimat seperti "12 gr" atau "150 ml", SEBUTKAN angka tersebut
- Contoh: "12 gr Bedak..." berarti beratnya adalah 12 gr
- Untuk pertanyaan "apa aja produk crystallure", CARI semua nama produk yang unik dari informasi yang diberikan dan buat daftar lengkap
- Untuk pertanyaan "ingredientsnya" atau "kandungannya", berikan daftar lengkap ingredients dari produk yang sedang dibicarakan
- PENTING: Untuk daftar produk, ekstrak semua nama produk unik dari metadata "Product" yang ada di informasi
- JANGAN katakan "Informasi tidak tersedia" kecuali benar-benar tidak ada informasi sama sekali

JAWABAN:`;

    try {
      const response = await this.groq_client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 600
      });
      
      return response.choices[0]?.message?.content?.trim() || "Maaf, tidak dapat menghasilkan jawaban.";
    } catch (error) {
      console.error('Groq API error:', error);
      return "Maaf, terjadi kesalahan saat memproses pertanyaan Anda.";
    }
  }

  async generate_answer_with_context(question: string, context: string, matches: SearchMatch[], conversationContext?: string): Promise<string> {
    // Handle product list questions specially
    const q_lower = question.toLowerCase();
    
    // More specific detection for product list questions
    const is_product_list_question = (
      // Direct product list questions
      (q_lower.includes('apa aja') && (q_lower.includes('produk') || q_lower.includes('crystallure'))) ||
      q_lower.includes('produk apa') ||
      q_lower.includes('daftar produk') ||
      q_lower.includes('semua produk') ||
      q_lower.includes('produk dari') ||
      q_lower.includes('produk crystallure') ||
      // Questions that explicitly ask for product listing
      (q_lower.includes('produk') && q_lower.includes('crystallure') && !q_lower.includes('ingredient') && !q_lower.includes('kandungan') && !q_lower.includes('cara'))
    );
    
    if (is_product_list_question) {
      console.log(`📋 Product list question detected: "${question}"`);
      return this.handleProductListQuestion(matches);
    }
    
    // Untuk pertanyaan spesifik tentang teknologi/kandungan, JANGAN gunakan context
    const is_specific_search = ['mengandung', 'kandungan', 'ingredient', 'komposisi', 'bahan', 'apa yang mengandung', 'yang dilengkapi', 'yang menggunakan', 'teknologi'].some(word => q_lower.includes(word));
    
    let direct_answer: string | null = null;
    
    if (is_specific_search) {
      console.log(`🔍 Specific search detected - skipping context for direct answer extraction`);
      direct_answer = this.extract_direct_answer(question, matches);
    } else {
      // Coba extract jawaban langsung dulu dengan context awareness
      direct_answer = this.extract_direct_answer_with_context(question, matches, conversationContext);
    }
    
    if (direct_answer) {
      return direct_answer;
    }
    
    // Jika tidak bisa extract langsung, pakai LLM dengan context
    let prompt = `Jawab pertanyaan berdasarkan informasi di bawah. PENTING: Baca semua informasi dengan teliti!

INFORMASI:
${context}

PERTANYAAN: ${question}`;

    // Add conversation context if available
    if (conversationContext) {
      prompt += `\n\nKONTEKS PERCAKAPAN:
${conversationContext}`;
    }

    prompt += `\n\nINSTRUKSI:
- Cari angka/nilai yang tepat (ml, gram, gr, g, Rp, %, dll)
- Jika ada angka di awal kalimat seperti "12 gr" atau "150 ml", SEBUTKAN angka tersebut
- Contoh: "12 gr Bedak..." berarti beratnya adalah 12 gr
- Untuk pertanyaan "apa aja produk crystallure", CARI semua nama produk yang unik dari informasi yang diberikan dan buat daftar lengkap
- Untuk pertanyaan "ingredientsnya" atau "kandungannya", berikan daftar lengkap ingredients dari produk yang sedang dibicarakan
- Jika ada konteks percakapan, gunakan untuk memahami referensi seperti "itu", "tadi", "sebelumnya"
- Berikan jawaban yang natural dan mengalir berdasarkan konteks percakapan
- PENTING: Untuk daftar produk, ekstrak semua nama produk unik dari metadata "Product" yang ada di informasi
- JANGAN katakan "Informasi tidak tersedia" kecuali benar-benar tidak ada informasi sama sekali

JAWABAN:`;

    try {
      const response = await this.groq_client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 600
      });
      
      return response.choices[0]?.message?.content?.trim() || "Maaf, tidak dapat menghasilkan jawaban.";
    } catch (error) {
      console.error('Groq API error:', error);
      return "Maaf, terjadi kesalahan saat memproses pertanyaan Anda.";
    }
  }
}
