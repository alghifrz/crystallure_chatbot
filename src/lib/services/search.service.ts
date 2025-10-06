import { SearchMatch, SearchResult, QuestionAnalysis } from '../types';
import { EmbeddingService } from './embedding.service';
import { QueryService } from './query.service';

export class SearchService {
  constructor(
    private embeddingService: EmbeddingService,
    private queryService: QueryService
  ) {}

  async search_pinecone(
    question: string, 
    pineconeIndex: any, 
    namespace: string, 
    product_name?: string | null, 
    top_k: number = 15
  ): Promise<SearchMatch[]> {
    const all_matches: SearchMatch[] = [];
    const seen_ids = new Set<string>();
    
    // Get expanded queries
    const queries = this.queryService.expand_query(question);
    
    // Analyze question
    const analysis = this.queryService.analyze_question(question);
    
    console.log(`🔍 Search strategy: has_crystallure=${analysis.hasCrystallure}, is_general=${analysis.isGeneralQuestion}, is_specific=${analysis.isSpecificSearch}`);
    
    // Untuk akses semua data, gunakan fetch limit yang lebih besar
    const fetch_limit = Math.max(analysis.fetchLimit, 200); // Minimum 200 untuk akses lebih banyak data
    
    // Search dengan original query
    const query_embedding = await this.embeddingService.get_embedding(this.embeddingService.normalize_query(question));
    const results = await pineconeIndex.namespace(namespace).query({
      vector: query_embedding,
      topK: fetch_limit,
      includeMetadata: true
    });
    
    // PRIORITAS: Untuk pertanyaan volume/berat, PAKSA include Overview section
    const needs_overview = ['berapa ml', 'berapa g', 'berapa gr', 'berapa gram', 'volume', 'berat', 'ukuran'].some(word => question.toLowerCase().includes(word));
    const overview_chunks: SearchMatch[] = [];
    
    // PRIORITAS: Untuk pertanyaan cara menggunakan, PAKSA include Cara Pakai section
    const needs_cara_pakai = ['cara menggunakan', 'cara pakai', 'how to use', 'gimana', 'bagaimana'].some(word => question.toLowerCase().includes(word));
    const cara_pakai_chunks: SearchMatch[] = [];
    
    // Filter berdasarkan strategi pencarian
    for (const match of results.matches) {
      // Skip jika product name tidak cocok (jika product_name specified)
      // Kecuali jika product_name adalah "Crystallure" general (untuk pertanyaan daftar produk)
      if (product_name && product_name !== 'Crystallure' && match.metadata?.product !== product_name) {
        continue;
      }
      
      // Collect overview chunks separately jika needed
      if (needs_overview && match.metadata?.section?.toLowerCase() === 'overview') {
        overview_chunks.push(match);
      }
      
      // Collect cara pakai chunks separately jika needed
      if (needs_cara_pakai && match.metadata?.section?.toLowerCase() === 'cara pakai') {
        cara_pakai_chunks.push(match);
      }
      
      // Untuk akses semua data, terima semua matches tanpa filtering ketat
      console.log(`✅ Accepting match: ${match.metadata?.product || 'Unknown'} | Section: ${match.metadata?.section || 'Unknown'}`);
      
      // Hanya skip jika benar-benar tidak relevan (score terlalu rendah)
      if (match.score < 0.1) {
        console.log(`❌ Skipping match - score too low: ${match.score.toFixed(3)}`);
        continue;
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
    
    // Jika butuh cara pakai tapi belum ada di top results, PAKSA masukkan
    if (needs_cara_pakai && cara_pakai_chunks.length > 0) {
      // Cek apakah cara pakai sudah ada di top 5
      const top_5_sections = all_matches.slice(0, 5).map(m => m.metadata?.section?.toLowerCase() || '');
      if (!top_5_sections.includes('cara pakai')) {
        // Insert cara pakai chunk di posisi 0 (paling atas)
        for (const cara_pakai of cara_pakai_chunks) {
          if (!all_matches.slice(0, 5).some(m => m.id === cara_pakai.id)) {
            console.log(`⚡ Forcing Cara Pakai section to top (score: ${cara_pakai.score.toFixed(3)})`);
            all_matches.unshift(cara_pakai);
            break;
          }
        }
      }
    }
    
    // Search dengan expanded queries (jika perlu lebih banyak results atau untuk pertanyaan spesifik)
    const needs_expansion = all_matches.length < 8 || 
      ['cara menggunakan', 'cara pakai', 'how to use', 'penggunaan', 'instructions'].some(phrase => 
        question.toLowerCase().includes(phrase));
    
    if (needs_expansion) {
      console.log(`🔄 Using expanded queries for better semantic matching`);
      for (const exp_query of queries.slice(0, 2)) { // Max 2 expansions
        if (exp_query !== question) {
          console.log(`🔍 Expanded query: "${exp_query}"`);
          const exp_embedding = await this.embeddingService.get_embedding(this.embeddingService.normalize_query(exp_query));
          const exp_results = await pineconeIndex.namespace(namespace).query({
            vector: exp_embedding,
            topK: 20,
            includeMetadata: true
          });
          
          for (const match of exp_results.matches) {
            // Filter by product name jika ada
            // Kecuali jika product_name adalah "Crystallure" general (untuk pertanyaan daftar produk)
            if (product_name && product_name !== 'Crystallure' && match.metadata?.product !== product_name) {
              continue;
            }
            
            if (!seen_ids.has(match.id)) {
              console.log(`✅ Added from expanded query: ${match.metadata?.product || 'Unknown'} | Section: ${match.metadata?.section || 'Unknown'} | Score: ${match.score?.toFixed(3)}`);
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
}
