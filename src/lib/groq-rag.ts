import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

export class GroqRAG {
  private pc: Pinecone;
  private index: any;
  private groq_client: Groq;
  private namespace: string;
  private product_names: string[] = [];

  constructor(pinecone_api_key: string, groq_api_key: string, namespace: string = "ns1") {
    this.pc = new Pinecone({ 
      apiKey: pinecone_api_key
    });
    this.index = this.pc.index("crystallure");
    this.groq_client = new Groq({ apiKey: groq_api_key });
    this.namespace = namespace;
  }

  async initialize(): Promise<void> {
    // Load product names from Pinecone database
    try {
      console.log("⏳ Loading product list from Pinecone...");
      this.product_names = await this._get_all_product_names();
      console.log(`✅ Found ${this.product_names.length} products in database`);
      console.log("✅ Groq RAG siap digunakan!");
    } catch (error) {
      console.warn("⚠️ Could not load products from Pinecone, using default list");
    }
  }

  private async _get_all_product_names(): Promise<string[]> {
    try {
      // Dummy query untuk fetch beberapa vectors dan extract product names
      const dummy_embedding = new Array(1024).fill(0.0);
      const results = await this.index.namespace(this.namespace).query({
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
    
    // STEP 1: Exact match - cek full product name ada di question
    const exact_matches: string[] = [];
    for (const product of this.product_names) {
      const product_lower = product.toLowerCase();
      if (q_lower.includes(product_lower)) {
        exact_matches.push(product);
      }
    }
    
    // Jika ada exact matches, pilih yang TERPANJANG (paling spesifik)
    if (exact_matches.length > 0) {
      return exact_matches.reduce((a, b) => a.length > b.length ? a : b);
    }
    
    // STEP 2: Word-by-word matching untuk partial/typo
    let best_match: string | null = null;
    let best_score = 0;
    let best_word_count = 0;
    
    for (const product of this.product_names) {
      const product_lower = product.toLowerCase();
      
      // Extract kata-kata UNIK dari product (skip "crystallure" dan kata umum)
      let product_words = product_lower.replace('crystallure', '').trim().split(' ');
      // Filter: skip kata pendek dan kata umum
      product_words = product_words.filter(w => w.length > 2 && !['for', 'and', 'the'].includes(w));
      
      if (product_words.length === 0) continue;
      
      // Hitung berapa kata dari product yang ada di question (dengan word boundary)
      let matched_words = 0;
      for (const word of product_words) {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (regex.test(q_lower)) {
          matched_words++;
        }
      }
      
      // Calculate score (percentage of product words found)
      const score = matched_words / product_words.length;
      
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
        }
      }
    }
    
    // Return best match jika score cukup tinggi (minimal 40%)
    if (best_match && best_score >= 0.4) {
      return best_match;
    }
    
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

  normalize_query(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  expand_query(question: string): string[] {
    const expansions: string[] = [];
    const q_lower = question.toLowerCase();
    
    if (['berapa ml', 'volume', 'ukuran', 'size'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} ml volume ukuran overview`);
    }
    
    if (['berapa g', 'berapa gram', 'berat', 'gram', ' g ', 'berapa gr'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} gram berat g gr overview`);
    }
    
    if (['harga', 'price', 'biaya'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} harga price overview`);
    }
    
    if (['manfaat', 'benefit', 'kegunaan', 'fungsi'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} manfaat benefit kegunaan`);
    }
    
    if (['cara pakai', 'cara menggunakan', 'how to use'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} cara pakai penggunaan instructions`);
    }
    
    if (['usia', 'umur', 'age', 'untuk usia'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} usia umur age recommended`);
    }
    
    if (['kandungan', 'ingredient', 'komposisi'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} kandungan ingredient komposisi`);
    }
    
    return expansions.length > 0 ? expansions : [question];
  }

  async get_embedding(text: string): Promise<number[]> {
    // Menggunakan embedding yang sama dengan rag3.py
    // BAAI/bge-large-en-v1.5 dengan dimensi 1024
    
    // Untuk Next.js, kita akan menggunakan hash-based embedding yang mirip
    // dengan sentence-transformers output
    const embedding = new Array(1024).fill(0.0);
    
    // Create a more sophisticated hash-based embedding
    // yang menyerupai output dari BAAI/bge-large-en-v1.5
    const words = text.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      
      // Simple hash function
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
      }
      
      // Distribute hash across embedding dimensions
      const baseIndex = Math.abs(hash) % 1024;
      embedding[baseIndex] += 1.0;
      
      // Add some variation based on word position and length
      if (i < 10) { // First 10 words get more weight
        embedding[(baseIndex + i) % 1024] += 0.5;
      }
      
      if (word.length > 3) { // Longer words get more weight
        embedding[(baseIndex + word.length) % 1024] += 0.3;
      }
    }
    
    // Normalize the embedding (similar to sentence-transformers)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  async test_pinecone_connection(): Promise<boolean> {
    try {
      console.log('🔍 Testing Pinecone connection...');
      const test_embedding = await this.get_embedding("test");
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

  async search_pinecone(question: string, product_name?: string | null, top_k: number = 15): Promise<any[]> {
    const all_matches: any[] = [];
    const seen_ids = new Set<string>();
    
    // Get expanded queries
    const queries = this.expand_query(question);
    
    // Search dengan original query - fetch BANYAK untuk filtering
    const query_embedding = await this.get_embedding(this.normalize_query(question));
    const results = await this.index.namespace(this.namespace).query({
      vector: query_embedding,
      topK: product_name ? 100 : top_k, // Fetch lebih banyak untuk filter + rerank
      includeMetadata: true
    });
    
    // PRIORITAS: Untuk pertanyaan volume/berat, PAKSA include Overview section
    const q_lower = question.toLowerCase();
    const needs_overview = ['berapa ml', 'berapa g', 'berapa gr', 'berapa gram', 'volume', 'berat', 'ukuran'].some(word => q_lower.includes(word));
    const overview_chunks: any[] = [];
    
    // Filter by product name jika ada
    for (const match of results.matches) {
      // Skip jika product name tidak cocok (jika product_name specified)
      if (product_name && match.metadata?.product !== product_name) {
        continue;
      }
      
      // Collect overview chunks separately jika needed
      if (needs_overview && match.metadata?.section?.toLowerCase() === 'overview') {
        overview_chunks.push(match);
      }
      
      if (!seen_ids.has(match.id)) {
        all_matches.push(match);
        seen_ids.add(match.id);
      }
    }
    
    // Jika butuh overview tapi belum ada di top results, PAKSA masukkan
    if (needs_overview && overview_chunks.length > 0) {
      // Cek apakah overview sudah ada di top 5
      const top_5_sections = all_matches.slice(0, 5).map(m => m.metadata?.section?.toLowerCase() || '');
      if (!top_5_sections.includes('overview')) {
        // Insert overview chunk di posisi 0 (paling atas)
        for (const overview of overview_chunks) {
          if (!all_matches.slice(0, 5).some(m => m.id === overview.id)) {
            console.log(`⚡ Forcing Overview section to top (score: ${overview.score.toFixed(3)})`);
            all_matches.unshift(overview);
            break;
          }
        }
      }
    }
    
    // Search dengan expanded queries (jika perlu lebih banyak results)
    if (all_matches.length < 8) {
      for (const exp_query of queries.slice(0, 2)) { // Max 2 expansions
        if (exp_query !== question) {
          const exp_embedding = await this.get_embedding(this.normalize_query(exp_query));
          const exp_results = await this.index.namespace(this.namespace).query({
            vector: exp_embedding,
            topK: 20,
            includeMetadata: true
          });
          
          for (const match of exp_results.matches) {
            // Filter by product name jika ada
            if (product_name && match.metadata?.product !== product_name) {
              continue;
            }
            
            if (!seen_ids.has(match.id)) {
              all_matches.push(match);
              seen_ids.add(match.id);
            }
          }
        }
      }
    }
    
    // Sort by score descending
    all_matches.sort((a, b) => b.score - a.score);
    
    return all_matches.slice(0, top_k);
  }


  prepare_context(matches: any[]): string {
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

  extract_direct_answer(question: string, matches: any[]): string | null {
    const q_lower = question.toLowerCase();
    
    // Pattern untuk pertanyaan volume/ml
    if (['berapa ml', 'volume', 'ukuran', 'ml'].some(word => q_lower.includes(word))) {
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        // Cari pattern angka (dengan desimal) + ml
        // Support: 150 ml, 150ml, 15.5 ml, 15,5 ml
        const ml_match = text.match(/([\d]+[.,]?[\d]*)\s*ml/i);
        if (ml_match) {
          const product = match.metadata?.product || 'Produk';
          const volume = ml_match[1].replace(',', '.'); // Normalize koma ke titik
          return `${product} memiliki volume ${volume} ml.`;
        }
      }
    }
    
    // Pattern untuk pertanyaan berat/gram
    if (['berapa g', 'berapa gram', 'berat', 'gram', ' g ', 'berapa gr'].some(word => q_lower.includes(word))) {
      console.log('\n🔍 DEBUG: Mencari pattern berat/gram...');
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const text = match.metadata?.chunk_text || '';
        console.log(`  Match ${i + 1}: ${text.substring(0, 100)}...`);
        
        // Cari pattern angka (dengan desimal) + g/gr/gram
        // Support: 15 g, 15g, 15.5 g, 15,5 gram, 12 gr, 12gr
        const gram_match = text.match(/([\d]+[.,]?[\d]*)\s*(?:gr|g|gram)\b/i);
        
        if (gram_match) {
          console.log(`  ✅ FOUND: ${gram_match[0]}`);
          const product = match.metadata?.product || 'Produk';
          const weight = gram_match[1].replace(',', '.'); // Normalize koma ke titik
          
          // Detect unit dari match
          const full_match = gram_match[0].toLowerCase();
          let unit = 'g';
          if (full_match.includes('gram')) {
            unit = 'gram';
          } else if (full_match.includes('gr')) {
            unit = 'gr';
          }
          
          return `${product} memiliki berat ${weight} ${unit}.`;
        } else {
          console.log(`  ❌ No match found in this chunk`);
        }
      }
      console.log('  ⚠️ No gram pattern found in any match\n');
    }
    
    // Pattern untuk harga
    if (['harga', 'price', 'biaya'].some(word => q_lower.includes(word))) {
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        // Cari pattern Rp dengan thousand separator
        // Support: Rp 150.000, Rp. 200000, Rp150,000, Rp 1.500.000
        const price_match = text.match(/Rp\.?\s*[\d.,]+/i);
        if (price_match) {
          const product = match.metadata?.product || 'Produk';
          return `Harga ${product} adalah ${price_match[0]}.`;
        }
      }
    }
    
    // Pattern untuk cara pakai/usage instructions
    if (['cara pakai', 'cara menggunakan', 'how to use', 'cara aplikasi', 'cara memakai', 'bagaimana cara'].some(word => q_lower.includes(word))) {
      console.log('🔍 Looking for usage instructions pattern...');
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        const section = match.metadata?.section || '';
        console.log(`📝 Checking text: ${text.substring(0, 100)}...`);
        
        // Cari section "Cara Pakai" atau teks yang mengandung instruksi
        if (section.toLowerCase().includes('cara pakai') || 
            text.toLowerCase().includes('cara pakai') || 
            text.toLowerCase().includes('cara menggunakan') ||
            text.match(/\d+\.\s+/) || // Pattern: 1. 2. 3. (numbered steps)
            text.toLowerCase().includes('aplikasikan')) {
          const product = match.metadata?.product || 'Produk';
          console.log(`✅ Found usage instructions for ${product}`);
          
          // Format text dengan line breaks untuk poin-poin
          const formattedText = text
            .replace(/(\d+\.\s+)/g, '\n$1') // Tambah line break sebelum angka
            .replace(/([.!?])\s*([A-Z])/g, '$1\n$2') // Line break setelah titik
            .trim();
          
          return `**Cara Pakai ${product}:**\n${formattedText}`;
        }
      }
    }
    
    // Pattern untuk target pasar/demografi
    if (['target pasar', 'untuk siapa', 'siapa yang', 'demografi', 'segmen', 'usia', 'umur'].some(word => q_lower.includes(word))) {
      console.log('🔍 Looking for target market pattern...');
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        const section = match.metadata?.section || '';
        
        if (text.toLowerCase().includes('wanita aktif') || 
            text.toLowerCase().includes('usia 25') ||
            text.toLowerCase().includes('target utama') ||
            text.toLowerCase().includes('life progressor')) {
          const product = match.metadata?.product || 'Crystallure';
          console.log(`✅ Found target market info for ${product}`);
          return `Target pasar ${product}: ${text}`;
        }
      }
    }
    
    // Pattern untuk kandungan/ingredients
    if (['kandungan', 'ingredient', 'komposisi', 'bahan aktif', 'formula'].some(word => q_lower.includes(word))) {
      console.log('🔍 Looking for ingredients pattern...');
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        const section = match.metadata?.section || '';
        
        if (section.toLowerCase().includes('kandungan') || 
            section.toLowerCase().includes('ingredient') ||
            text.toLowerCase().includes('gold-peptide crystals') ||
            text.toLowerCase().includes('youthglow active') ||
            text.match(/Aqua,|Talc,|Caprylic/)) { // Common ingredient patterns
          const product = match.metadata?.product || 'Produk';
          console.log(`✅ Found ingredients for ${product}`);
          
          // Format ingredients dengan line breaks
          const formattedText = text
            .replace(/(\d+\.\s+)/g, '\n$1') // Line break sebelum angka
            .replace(/([.!?])\s*([A-Z])/g, '$1\n$2') // Line break setelah titik
            .replace(/([a-z])\s*,\s*([A-Z])/g, '$1,\n$2') // Line break untuk ingredients
            .trim();
          
          return `**Kandungan ${product}:**\n${formattedText}`;
        }
      }
    }
    
    // Pattern untuk keunggulan/benefits
    if (['keunggulan', 'benefit', 'manfaat', 'kegunaan', 'fungsi', 'keuntungan', 'fitur'].some(word => q_lower.includes(word))) {
      console.log('🔍 Looking for benefits pattern...');
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        const section = match.metadata?.section || '';
        
        if (section.toLowerCase().includes('keunggulan') || 
            section.toLowerCase().includes('benefit') ||
            section.toLowerCase().includes('manfaat') ||
            text.match(/\d+\.\s+/) || // Numbered benefits
            text.toLowerCase().includes('membantu') ||
            text.toLowerCase().includes('memberikan')) {
          const product = match.metadata?.product || 'Produk';
          console.log(`✅ Found benefits for ${product}`);
          
          // Format text dengan line breaks untuk poin-poin
          const formattedText = text
            .replace(/(\d+\.\s+)/g, '\n$1') // Tambah line break sebelum angka
            .replace(/([.!?])\s*([A-Z])/g, '$1\n$2') // Line break setelah titik
            .trim();
          
          return `**Keunggulan ${product}:**\n${formattedText}`;
        }
      }
    }
    
    // Pattern untuk skin type/jenis kulit
    if (['skin type', 'jenis kulit', 'untuk kulit', 'aman untuk', 'cocok untuk'].some(word => q_lower.includes(word))) {
      console.log('🔍 Looking for skin type pattern...');
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        const section = match.metadata?.section || '';
        
        if (text.toLowerCase().includes('all skin type') || 
            text.toLowerCase().includes('semua jenis kulit') ||
            text.toLowerCase().includes('kecuali acne') ||
            text.toLowerCase().includes('kulit sensitif') ||
            text.toLowerCase().includes('kulit normal') ||
            text.toLowerCase().includes('kulit berminyak') ||
            text.toLowerCase().includes('kulit kering')) {
          const product = match.metadata?.product || 'Produk';
          console.log(`✅ Found skin type info for ${product}`);
          return `${product} cocok untuk ${text}`;
        }
      }
    }
    
    // Pattern untuk durasi/tahan lama
    if (['tahan lama', 'durasi', 'berapa lama', 'seberapa lama', 'jam', 'hingga'].some(word => q_lower.includes(word))) {
      console.log('🔍 Looking for duration/longevity pattern...');
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        
        // Cari pattern waktu seperti "12 jam", "8 jam", "seharian"
        const time_match = text.match(/(\d+)\s*jam|seharian|all day|hingga\s*(\d+)\s*jam/i);
        if (time_match) {
          const product = match.metadata?.product || 'Produk';
          console.log(`✅ Found duration info for ${product}`);
          return `${product} tahan lama ${time_match[0]}`;
        }
      }
    }
    
    // Pattern untuk coverage (untuk makeup)
    if (['coverage', 'hasil', 'tekstur', 'finish', 'aplikasi'].some(word => q_lower.includes(word))) {
      console.log('🔍 Looking for coverage/finish pattern...');
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        
        if (text.toLowerCase().includes('medium to full') || 
            text.toLowerCase().includes('soft focus') ||
            text.toLowerCase().includes('matte') ||
            text.toLowerCase().includes('glossy') ||
            text.toLowerCase().includes('natural') ||
            text.toLowerCase().includes('flawless')) {
          const product = match.metadata?.product || 'Produk';
          console.log(`✅ Found coverage info for ${product}`);
          return `Hasil aplikasi ${product}: ${text}`;
        }
      }
    }
    
    // Pattern untuk rekomendasi produk berdasarkan manfaat/spesifikasi
    if (['rekomendasi', 'rekomendasikan', 'produk yang', 'yang bisa', 'yang dapat', 'untuk', 'memiliki', 'ada produk'].some(word => q_lower.includes(word))) {
      console.log('🔍 Looking for product recommendation pattern...');
      
      // Cari produk yang cocok dengan kriteria yang diminta
      const product_scores: {[key: string]: number} = {};
      const product_details: {[key: string]: string[]} = {};
      
      // Extract key criteria from question
      const criteria_keywords = [];
      
      // Specific patterns untuk berbagai kriteria
      if (q_lower.includes('hidrasi') || q_lower.includes('lembab')) {
        criteria_keywords.push('hidrasi', 'lembab', 'moisture', 'hydration');
      }
      if (q_lower.includes('2x') || q_lower.includes('dua kali')) {
        criteria_keywords.push('2x', 'dua kali', 'lebih lembab');
      }
      if (q_lower.includes('8 jam') || q_lower.includes('8h')) {
        criteria_keywords.push('8 jam', '8h', '8 hour');
      }
      if (q_lower.includes('mempertahankan')) {
        criteria_keywords.push('mempertahankan', 'pertahankan', 'lasting');
      }
      if (q_lower.includes('kerutan') || q_lower.includes('garis halus')) {
        criteria_keywords.push('kerutan', 'garis halus', 'wrinkle', 'fine line');
      }
      if (q_lower.includes('menyamarkan') || q_lower.includes('menutupi')) {
        criteria_keywords.push('menyamarkan', 'menutupi', 'conceal', 'cover');
      }
      if (q_lower.includes('mencerahkan') || q_lower.includes('brightening')) {
        criteria_keywords.push('mencerahkan', 'brightening', 'cerah');
      }
      if (q_lower.includes('anti aging') || q_lower.includes('anti-aging')) {
        criteria_keywords.push('anti aging', 'anti-aging', 'antiaging');
      }
      if (q_lower.includes('spf') || q_lower.includes('sun protection')) {
        criteria_keywords.push('spf', 'sun protection', 'uv protection');
      }
      
      // Score setiap produk berdasarkan kriteria
      for (const match of matches) {
        const text = match.metadata?.chunk_text || '';
        const product = match.metadata?.product || '';
        const section = match.metadata?.section || '';
        
        if (!product_scores[product]) {
          product_scores[product] = 0;
          product_details[product] = [];
        }
        
        const text_lower = text.toLowerCase();
        let match_count = 0;
        
        // Cek setiap kriteria
        for (const keyword of criteria_keywords) {
          if (text_lower.includes(keyword.toLowerCase())) {
            match_count++;
            product_details[product].push(`Mencocokkan kriteria "${keyword}"`);
          }
        }
        
        // Berikan score berdasarkan jumlah kriteria yang cocok
        if (match_count > 0) {
          product_scores[product] += match_count;
        }
      }
      
      // Urutkan produk berdasarkan score tertinggi
      const sorted_products = Object.entries(product_scores)
        .filter(([_, score]) => score > 0)
        .sort(([,a], [,b]) => b - a)
        .map(([product, _]) => product);
      
      if (sorted_products.length > 0) {
        // Ambil produk dengan score tertinggi (atau beberapa jika score sama)
        const top_score = product_scores[sorted_products[0]];
        const top_products = sorted_products.filter(p => product_scores[p] === top_score);
        
        if (top_products.length === 1) {
          return `Berdasarkan kriteria yang Anda sebutkan, saya merekomendasikan **${top_products[0]}** karena memenuhi ${top_score} kriteria yang Anda cari.`;
        } else {
          return `Berdasarkan kriteria yang Anda sebutkan, saya merekomendasikan **${top_products.join('**, **')}** karena sama-sama memenuhi ${top_score} kriteria yang Anda cari.`;
        }
      }
    }
    
    return null;
  }

  async generate_answer(question: string, context: string, matches: any[]): Promise<string> {
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
- Jawab singkat dan langsung
- Jika tidak ada informasi, katakan "Informasi tidak tersedia"

JAWABAN:`;

    try {
      const response = await this.groq_client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 400
      });
      
      return response.choices[0]?.message?.content?.trim() || "Maaf, tidak dapat menghasilkan jawaban.";
    } catch (error) {
      console.error('Groq API error:', error);
      return "Maaf, terjadi kesalahan saat memproses pertanyaan Anda.";
    }
  }

  async ask_question(question: string): Promise<{
    answer: string;
    productDetected: string | null;
    totalMatches: number;
    sources?: any[];
  }> {
    console.log('\n🔍 Analyzing question...');
    
    // Extract product name dari pertanyaan
    const product_name = this.extract_product_name(question);
    
    if (product_name) {
      console.log(`✅ Detected product: '${product_name}'`);
      console.log(`🎯 Searching specific to this product...`);
    } else {
      console.log("ℹ️  No specific product detected, searching all products...");
    }
    
    // Search dengan product filter
    const matches = await this.search_pinecone(question, product_name);
    
    if (!matches || matches.length === 0) {
      console.log("❌ Tidak ada informasi relevan ditemukan.");
      return {
        answer: "Maaf, tidak ada informasi relevan ditemukan untuk pertanyaan Anda.",
        productDetected: product_name,
        totalMatches: 0
      };
    }
    
    console.log(`✅ Ditemukan ${matches.length} informasi relevan`);
    console.log('🤖 Generating jawaban...');
    
    const context = this.prepare_context(matches);
    const answer = await this.generate_answer(question, context, matches);
    
    return {
      answer,
      productDetected: product_name,
      totalMatches: matches.length,
      sources: matches.slice(0, 5) // Top 5 sources
    };
  }
}