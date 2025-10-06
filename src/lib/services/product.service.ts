import { ProductInfo } from '../types';

export class ProductService {
  private product_names: string[] = [];

  constructor() {
    // Initialize dengan fallback product names
    this.product_names = [
      "Crystallure Moisture Rich Cleansing Foam",
      "Crystallure Supreme Double Action Micellar Gel", 
      "Crystallure Precious All Day Corrective Concealer",
      "Crystallure Precious Lustre Prism Blush",
      "Crystallure Precious Lustre Prism Eyeshadow",
      "Crystallure Precious Lustre Prism Lipstick",
      "Crystallure Supreme Advanced Hydra Gel",
      "Crystallure Supreme Activating Overnight Cream",
      "Crystallure Supreme Revitalizing Rich Cream",
      "Crystallure Dual Refining Treatment Solution",
      "Crystallure Precious Luminizing Silk Powder Foundation",
      "Crystallure Supreme Advanced Eye Serum",
      "Crystallure Supreme Activating Booster Essence",
      "Crystallure Precious Liquid Lip Couture",
      "Crystallure Precious Glow Radiance Powder",
      "Crystallure Supreme Revitalizing Oil Serum"
    ];
  }

  async loadProductNames(pineconeIndex: any, namespace: string): Promise<void> {
    try {
      console.log("⏳ Loading product list from Pinecone...");
      this.product_names = await this._get_all_product_names(pineconeIndex, namespace);
      console.log(`✅ Found ${this.product_names.length} products in database`);
      console.log("📋 Product names:", this.product_names);
    } catch (error) {
      console.warn("⚠️ Could not load products from Pinecone, using default list");
      console.log("📋 Using fallback product names:", this.product_names);
    }
  }

  private async _get_all_product_names(pineconeIndex: any, namespace: string): Promise<string[]> {
    try {
      // Dummy query untuk fetch beberapa vectors dan extract product names
      const dummy_embedding = new Array(1024).fill(0.0);
      const results = await pineconeIndex.namespace(namespace).query({
        vector: dummy_embedding,
        topK: 100, // Fetch banyak untuk get all products
        includeMetadata: true
      });
      
      const products = new Set<string>();
      for (const match of results.matches) {
        if (match.metadata?.product) {
          products.add(match.metadata.product);
        }
      }
      
      return Array.from(products);
    } catch (error) {
      console.error("Error loading product names:", error);
      return []; // Return empty list instead of default
    }
  }

  extract_product_name(question: string): string | null {
    const q_lower = question.toLowerCase();
    
    console.log(`🔍 Extracting product from: "${question}"`);
    console.log(`📋 Available products: ${this.product_names.length} products`);
    
    // STEP 1: Exact match - cek full product name ada di question
    const exact_matches: string[] = [];
    for (const product of this.product_names) {
      const product_lower = product.toLowerCase();
      if (q_lower.includes(product_lower)) {
        exact_matches.push(product);
        console.log(`✅ Exact match found: "${product}"`);
      }
    }
    
    // Jika ada exact matches, pilih yang TERPANJANG (paling spesifik)
    if (exact_matches.length > 0) {
      const best_match = exact_matches.reduce((a, b) => a.length > b.length ? a : b);
      console.log(`🎯 Selected best match: "${best_match}"`);
      return best_match;
    }
    
    // STEP 2: Word-by-word matching untuk partial/typo
    let best_match: string | null = null;
    let best_score = 0;
    let best_word_count = 0;
    
    console.log("🔍 Trying word-by-word matching...");
    
    for (const product of this.product_names) {
      const product_lower = product.toLowerCase();
      
      // Extract kata-kata UNIK dari product (skip "crystallure" dan kata umum)
      let product_words = product_lower.replace('crystallure', '').trim().split(' ');
      // Filter: skip kata pendek dan kata umum (tapi jangan skip kata penting seperti 'all', 'day' untuk produk tertentu)
      product_words = product_words.filter(w => w.length > 2 && !['for', 'and', 'the'].includes(w));
      
      if (product_words.length === 0) continue;
      
      console.log(`  📝 Checking product: "${product}"`);
      console.log(`  📝 Product words: [${product_words.join(', ')}]`);
      
      // Hitung berapa kata dari product yang ada di question (dengan word boundary)
      let matched_words = 0;
      for (const word of product_words) {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (regex.test(q_lower)) {
          matched_words++;
          console.log(`    ✅ Matched word: "${word}"`);
        }
      }
      
      // Calculate score (percentage of product words found)
      const score = matched_words / product_words.length;
      console.log(`  📊 Score: ${score.toFixed(2)} (${matched_words}/${product_words.length} words)`);
      
      // Update best match: prioritas score tinggi DAN jumlah kata matched banyak
      if (score > 0) {
        let is_better = false;
        
        // Lebih baik jika score lebih tinggi
        if (score > best_score) {
          is_better = true;
        }
        // Atau score sama tapi matched words lebih banyak (produk lebih spesifik)
        else if (score === best_score && matched_words > best_word_count) {
          is_better = true;
        }
        // Atau score sama, matched words sama, tapi produk lebih panjang (lebih spesifik)
        else if (score === best_score && matched_words === best_word_count && product.length > (best_match?.length || 0)) {
          is_better = true;
        }
        
        if (is_better) {
          best_score = score;
          best_match = product;
          best_word_count = matched_words;
          console.log(`    🎯 New best match: "${product}" (score: ${score.toFixed(2)})`);
        }
      }
    }
    
    // Return best match jika score cukup tinggi (minimal 40%)
    if (best_match && best_score >= 0.4) {
      console.log(`🎯 Final word-by-word match: "${best_match}" (score: ${best_score.toFixed(2)})`);
      return best_match;
    }
    
    console.log(`❌ No suitable word-by-word match found (best score: ${best_score.toFixed(2)})`);
    
    // STEP 3: Fallback - Fuzzy matching untuk typo (simplified version)
    const question_clean = q_lower.replace(/\b(berapa|apa|untuk|yang|adalah|tentang|bagaimana|kapan|siapa|dimana|crystallure)\b/g, '').trim();
    
    if (question_clean.length > 3) {
      // Compare dengan product names (tanpa "Crystallure" prefix)
      const product_names_clean = this.product_names.map(p => p.toLowerCase().replace('crystallure', '').trim());
      
      // Simple fuzzy matching (simplified from difflib)
      for (let i = 0; i < product_names_clean.length; i++) {
        const clean_name = product_names_clean[i];
        if (clean_name.length > 0) {
          // Check if question contains significant part of product name
          const words = clean_name.split(' ').filter(w => w.length > 2);
          let match_count = 0;
          for (const word of words) {
            if (question_clean.includes(word)) {
              match_count++;
            }
          }
          
          if (match_count >= words.length * 0.4) { // 40% of words match
            return this.product_names[i];
          }
        }
      }
    }
    
    return null;
  }

  extract_product_name_with_context(question: string, conversationContext?: string): string | null {
    const q_lower = question.toLowerCase();
    
    console.log(`🔍 Extracting product from: "${question}"`);
    
    // STEP 1: Check if question mentions a specific product name directly
    // This has highest priority - ignore context if specific product is mentioned
    
    // First, check for general "Crystallure" in product list questions
    const is_product_list_question = ['apa aja', 'produk apa', 'daftar produk', 'semua produk', 'produk dari', 'produk crystallure'].some(phrase => q_lower.includes(phrase));
    if (is_product_list_question && q_lower.includes('crystallure')) {
      console.log(`🎯 General Crystallure detected for product list question`);
      return 'Crystallure';
    }
    
    // Then check for specific products
    const specific_products = this.product_names.filter(p => {
      if (p.toLowerCase() === 'crystallure') return false; // Skip general Crystallure for specific searches
      
      // Check for exact match first
      if (q_lower.includes(p.toLowerCase())) {
        // Additional check: make sure it's not just matching "Crystallure" part
        const productWithoutCrystallure = p.toLowerCase().replace('crystallure', '').trim();
        if (productWithoutCrystallure.length > 0) {
          return q_lower.includes(productWithoutCrystallure);
        }
        return true;
      }
      return false;
    });
    
    if (specific_products.length > 0) {
      const best_match = specific_products.reduce((a, b) => a.length > b.length ? a : b);
      console.log(`🎯 Specific product detected in question: ${best_match}`);
      return best_match;
    }
    
    // STEP 2: Check for reference words and use context (only if no specific product mentioned)
    const referenceWords = ['itu', 'tadi', 'sebelumnya', 'yang', 'produk', 'item', 'berapa', 'harga', 'cara', 'keunggulan', 'tersebut', 'nya'];
    const hasReference = referenceWords.some(word => q_lower.includes(word));
    
    if (hasReference && conversationContext) {
      console.log(`🔍 Checking context for reference: ${conversationContext}`);
      
      // Try to extract last mentioned product from context
      const contextLines = conversationContext.split('\n');
      for (const line of contextLines) {
        if (line.includes('Produk yang sedang dibicarakan:')) {
          const lastProduct = line.replace('Produk yang sedang dibicarakan:', '').trim();
          if (lastProduct && lastProduct !== 'null' && lastProduct !== 'Crystallure') {
            console.log(`🔄 Using context product: ${lastProduct}`);
            return lastProduct;
          }
        }
      }
      
      // Alternative: look for product names in conversation history
      for (const line of contextLines) {
        for (const product of this.product_names) {
          if (product.toLowerCase() !== 'crystallure' && line.toLowerCase().includes(product.toLowerCase())) {
            console.log(`🔄 Found specific product in context: ${product}`);
            return product;
          }
        }
      }
    }
    
    // STEP 3: If no specific product found, return null for general search
    console.log(`ℹ️ No specific product detected - searching all data`);
    return null;
  }

  getProductNames(): string[] {
    return this.product_names;
  }
}
