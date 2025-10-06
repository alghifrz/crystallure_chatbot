// Session Manager untuk menyimpan conversation history dan context
interface ConversationMessage {
  id: string;
  timestamp: Date;
  type: 'user' | 'assistant';
  content: string;
  productDetected?: string;
}

interface SessionContext {
  sessionId: string;
  lastProductMentioned?: string;
  conversationHistory: ConversationMessage[];
  createdAt: Date;
  lastActivity: Date;
}

class SessionManager {
  private sessions: Map<string, SessionContext> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 menit

  // Generate unique session ID
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get or create session
  getSession(sessionId: string): SessionContext {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        conversationHistory: [],
        createdAt: new Date(),
        lastActivity: new Date()
      });
    }
    
    const session = this.sessions.get(sessionId)!;
    session.lastActivity = new Date();
    return session;
  }

  // Add message to session
  addMessage(sessionId: string, message: ConversationMessage): void {
    const session = this.getSession(sessionId);
    session.conversationHistory.push(message);
    
    // Update last product mentioned if detected
    if (message.productDetected) {
      // Clear context if general "Crystallure" is detected (to prevent context pollution)
      if (message.productDetected === 'Crystallure') {
        console.log(`🧹 Clearing context due to general Crystallure detection`);
        session.lastProductMentioned = undefined;
      } else {
        session.lastProductMentioned = message.productDetected;
      }
    }
    
    // Keep only last 10 messages to avoid memory bloat
    if (session.conversationHistory.length > 10) {
      session.conversationHistory = session.conversationHistory.slice(-10);
    }
  }

  // Get conversation context for RAG
  getConversationContext(sessionId: string): string {
    const session = this.getSession(sessionId);
    const recentMessages = session.conversationHistory.slice(-5); // Last 5 messages
    
    let context = '';
    if (session.lastProductMentioned) {
      context += `Produk yang sedang dibicarakan: ${session.lastProductMentioned}\n`;
    }
    
    if (recentMessages.length > 0) {
      context += 'Percakapan sebelumnya:\n';
      recentMessages.forEach(msg => {
        const role = msg.type === 'user' ? 'User' : 'Assistant';
        context += `${role}: ${msg.content}\n`;
      });
    }
    
    return context;
  }

  // Clean up expired sessions
  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Get session stats
  getStats() {
    return {
      activeSessions: this.sessions.size,
      totalMessages: Array.from(this.sessions.values()).reduce(
        (sum, session) => sum + session.conversationHistory.length, 0
      )
    };
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

// Cleanup expired sessions every 10 minutes
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 10 * 60 * 1000);

export type { ConversationMessage, SessionContext };
