import { QuestionAnalysis } from '../types';

export class QueryService {
  expand_query(question: string): string[] {
    const expansions: string[] = [];
    const q_lower = question.toLowerCase();
    
    // Pertanyaan umum tentang produk
    if (['apa aja', 'produk apa', 'daftar produk', 'semua produk', 'produk dari', 'produk crystallure'].some(phrase => q_lower.includes(phrase))) {
      expansions.push(`${question} overview daftar produk list semua produk`);
    }
    
    // Pertanyaan tentang kandungan/ingredients
    if (['mengandung', 'kandungan', 'ingredient', 'komposisi', 'bahan', 'apa yang mengandung'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} kandungan ingredient komposisi bahan aktif`);
    }
    
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
    
    if (['cara pakai', 'cara menggunakan', 'how to use', 'gimana', 'bagaimana'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} cara pakai cara menggunakan penggunaan instructions how to use step by step tutorial`);
    }
    
    if (['usia', 'umur', 'age', 'untuk usia'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} usia umur age recommended`);
    }
    
    if (['kandungan', 'ingredient', 'komposisi'].some(word => q_lower.includes(word))) {
      expansions.push(`${question} kandungan ingredient komposisi`);
    }
    
    return expansions.length > 0 ? expansions : [question];
  }

  analyze_question(question: string): QuestionAnalysis {
    const q_lower = question.toLowerCase();
    const has_crystallure = q_lower.includes('crystallure');
    const is_general_question = ['apa aja', 'produk apa', 'daftar produk', 'semua produk', 'produk dari', 'produk crystallure'].some(phrase => q_lower.includes(phrase));
    const is_specific_search = ['mengandung', 'kandungan', 'ingredient', 'komposisi', 'bahan', 'apa yang mengandung', 'yang dilengkapi', 'yang menggunakan', 'teknologi'].some(word => q_lower.includes(word));
    const is_ingredient_question = ['ingredientsnya', 'kandungannya', 'ingredientnya', 'komposisinya'].some(word => q_lower.includes(word));
    
    // Untuk akses semua data, selalu gunakan content_based dan fetch limit besar
    const search_strategy = 'content_based';
    const fetch_limit = Math.max(300, is_general_question ? 500 : (is_ingredient_question ? 400 : (is_specific_search ? 300 : 200)));
    
    return {
      isGeneralQuestion: is_general_question,
      isSpecificSearch: is_specific_search,
      isIngredientQuestion: is_ingredient_question,
      hasCrystallure: has_crystallure,
      searchStrategy: search_strategy,
      fetchLimit: fetch_limit
    };
  }
}
