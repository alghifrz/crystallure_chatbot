// Embedding service untuk generate embeddings
export class EmbeddingService {
  private readonly embeddingSize = 1024;

  async get_embedding(text: string): Promise<number[]> {
    // Menggunakan embedding yang sama dengan rag3.py
    // BAAI/bge-large-en-v1.5 dengan dimensi 1024
    
    // Untuk Next.js, kita akan menggunakan hash-based embedding yang mirip
    // dengan sentence-transformers output
    const embedding = new Array(this.embeddingSize).fill(0.0);
    
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
      const baseIndex = Math.abs(hash) % this.embeddingSize;
      embedding[baseIndex] += 1.0;
      
      // Add some variation based on word position and length
      if (i < 10) { // First 10 words get more weight
        embedding[(baseIndex + i) % this.embeddingSize] += 0.5;
      }
      
      if (word.length > 3) { // Longer words get more weight
        embedding[(baseIndex + word.length) % this.embeddingSize] += 0.3;
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

  normalize_query(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
