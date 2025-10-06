# Crystallure RAG System - Modular Architecture

## Overview
This is a modular RAG (Retrieval-Augmented Generation) system for the Crystallure chatbot, designed with clean separation of concerns and easy maintainability.

## Architecture

### 📁 Directory Structure
```
src/lib/
├── types/                 # TypeScript interfaces and types
│   └── index.ts
├── services/             # Business logic services
│   ├── embedding.service.ts
│   ├── product.service.ts
│   ├── query.service.ts
│   ├── search.service.ts
│   └── answer.service.ts
├── groq-rag-modular.ts   # Main RAG class (modular)
├── groq-rag.ts          # Original RAG class (monolithic)
├── groq-rag-simple.ts   # Simplified RAG class
└── index.ts             # Main exports
```

### 🏗️ Services Architecture

#### 1. **EmbeddingService**
- **Purpose**: Handle text embedding generation
- **Responsibilities**:
  - Generate embeddings using hash-based algorithm
  - Normalize query text
  - Maintain embedding consistency

#### 2. **ProductService**
- **Purpose**: Manage product detection and extraction
- **Responsibilities**:
  - Load product names from Pinecone
  - Extract product names from questions
  - Handle context-aware product detection
  - Manage fallback product lists

#### 3. **QueryService**
- **Purpose**: Analyze and expand user queries
- **Responsibilities**:
  - Analyze question types (general, specific, ingredient)
  - Expand queries with related terms
  - Determine search strategies
  - Calculate fetch limits

#### 4. **SearchService**
- **Purpose**: Handle Pinecone search operations
- **Responsibilities**:
  - Execute vector searches
  - Filter results based on strategy
  - Handle overview section prioritization
  - Manage expanded query searches

#### 5. **AnswerService**
- **Purpose**: Generate answers using LLM
- **Responsibilities**:
  - Prepare context from search results
  - Generate prompts for LLM
  - Handle direct answer extraction
  - Manage context-aware responses

### 🔧 Main RAG Class (GroqRAG)

The main `GroqRAG` class orchestrates all services:

```typescript
export class GroqRAG {
  // Services
  private embeddingService: EmbeddingService;
  private productService: ProductService;
  private queryService: QueryService;
  private searchService: SearchService;
  private answerService: AnswerService;

  // Main method
  async ask_question(question: string, conversationContext?: string): Promise<AnswerResult>
}
```

### 📊 Data Flow

1. **Question Analysis** → `QueryService.analyze_question()`
2. **Product Detection** → `ProductService.extract_product_name_with_context()`
3. **Vector Search** → `SearchService.search_pinecone()`
4. **Context Preparation** → `AnswerService.prepare_context()`
5. **Answer Generation** → `AnswerService.generate_answer_with_context()`

### 🎯 Benefits of Modular Architecture

#### ✅ **Separation of Concerns**
- Each service has a single responsibility
- Easy to test individual components
- Clear boundaries between functionality

#### ✅ **Maintainability**
- Changes to one service don't affect others
- Easy to add new features
- Clear code organization

#### ✅ **Reusability**
- Services can be used independently
- Easy to create different RAG configurations
- Modular testing capabilities

#### ✅ **Type Safety**
- Strong TypeScript interfaces
- Clear data contracts
- Compile-time error checking

#### ✅ **Scalability**
- Easy to add new services
- Simple to extend functionality
- Clean dependency management

### 🚀 Usage Examples

#### Basic Usage
```typescript
import { GroqRAG } from '@/lib';

const rag = new GroqRAG(pineconeKey, groqKey);
await rag.initialize();

const result = await rag.ask_question("apa aja produk crystallure?");
console.log(result.answer);
```

#### Advanced Usage (Individual Services)
```typescript
import { EmbeddingService, ProductService, QueryService } from '@/lib';

const embeddingService = new EmbeddingService();
const productService = new ProductService();
const queryService = new QueryService();

// Use services independently
const embedding = await embeddingService.get_embedding("test query");
const product = productService.extract_product_name("Crystallure Cleansing Foam");
const analysis = queryService.analyze_question("apa aja produk crystallure?");
```

### 🔄 Migration from Monolithic

The modular version maintains backward compatibility:

```typescript
// Old way (still works)
const rag = new GroqRAG(pineconeKey, groqKey);
await rag.initialize();
const result = await rag.ask_question(question, context);

// New way (more flexible)
const rag = new GroqRAG(pineconeKey, groqKey);
await rag.initialize();
const result = await rag.ask_question(question, context);
```

### 🧪 Testing Strategy

Each service can be tested independently:

```typescript
// Test individual services
describe('ProductService', () => {
  it('should extract product names correctly', () => {
    const service = new ProductService();
    const result = service.extract_product_name("Crystallure Cleansing Foam");
    expect(result).toBe("Crystallure Moisture Rich Cleansing Foam");
  });
});

// Test main RAG class
describe('GroqRAG', () => {
  it('should handle general questions', async () => {
    const rag = new GroqRAG(pineconeKey, groqKey);
    const result = await rag.ask_question("apa aja produk crystallure?");
    expect(result.answer).toContain("produk");
  });
});
```

### 📈 Performance Benefits

- **Lazy Loading**: Services are initialized only when needed
- **Memory Efficiency**: Clear service boundaries prevent memory leaks
- **Caching**: Individual services can implement their own caching strategies
- **Parallel Processing**: Services can be optimized independently

### 🔮 Future Enhancements

The modular architecture makes it easy to add:

- **Caching Service**: For embedding and search result caching
- **Analytics Service**: For tracking user interactions
- **Validation Service**: For input validation and sanitization
- **Translation Service**: For multi-language support
- **Recommendation Service**: For product recommendations

### 🛠️ Development Guidelines

1. **Single Responsibility**: Each service should have one clear purpose
2. **Dependency Injection**: Services should be injected, not created internally
3. **Interface Segregation**: Use specific interfaces, not large ones
4. **Error Handling**: Each service should handle its own errors
5. **Logging**: Consistent logging across all services
6. **Testing**: Each service should be unit testable

This modular architecture provides a solid foundation for the Crystallure RAG system while maintaining flexibility and maintainability.
