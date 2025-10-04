# 🌟 Crystallure Smart Chatbot

A Next.js-based AI chatbot for Crystallure products information using RAG (Retrieval-Augmented Generation) with Pinecone vector database and Groq LLM.

## 🚀 Features

- **Smart Product Detection**: Automatically detects product names from user questions
- **RAG-Powered Answers**: Uses Pinecone vector database for accurate information retrieval
- **Modern UI**: Beautiful, responsive chat interface with real-time messaging
- **Source Attribution**: Shows sources and relevance scores for transparency
- **Direct Answer Extraction**: Extracts specific values (volume, weight, price) directly from data

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
cd crystallure_chatbot
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
PINECONE_API_KEY=your_pinecone_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
crystallure_chatbot/
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts    # Chat API endpoint
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/
│   │   └── ChatInterface.tsx   # Main chat component
│   └── lib/
│       └── groq-rag.ts         # RAG implementation
├── package.json
└── README.md
```

## 🔧 API Endpoints

### POST `/api/chat`

Send a question to the chatbot.

**Request Body:**
```json
{
  "question": "berapa ml Crystallure Supreme Double Action?"
}
```

**Response:**
```json
{
  "answer": "Crystallure Supreme Double Action memiliki volume 150 ml.",
  "sources": [
    {
      "id": 1,
      "product": "Crystallure Supreme Double Action",
      "section": "Overview",
      "text": "...",
      "score": 95,
      "preview": "..."
    }
  ],
  "productDetected": "Crystallure Supreme Double Action",
  "totalMatches": 5
}
```

## 🎯 Usage Examples

- **Volume Questions**: "berapa ml Crystallure Supreme?"
- **Weight Questions**: "berapa gram Crystallure Classic?"
- **Price Questions**: "harga Crystallure Premium berapa?"
- **Benefits**: "manfaat Crystallure Advanced apa saja?"
- **Usage Instructions**: "cara pakai Crystallure Supreme?"

## 🏗️ Architecture

1. **Frontend**: Next.js 15 with React 19 and Tailwind CSS
2. **Backend**: Next.js API routes
3. **Vector Database**: Pinecone for semantic search
4. **LLM**: Groq for answer generation
5. **Embeddings**: Sentence Transformers (BAAI/bge-large-en-v1.5)

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 🔒 Security Notes

- API keys are stored in environment variables
- Never commit `.env.local` to version control
- Consider using a secrets management service for production

## 📝 License

This project is for educational and demonstration purposes.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!