// Storage Manager Utility
// Handles Chrome Storage operations

class StorageManager {
  // API Key Management
  static async saveAPIKey(apiKey) {
    try {
      // In production, should encrypt the API key
      await chrome.storage.sync.set({ 
        gemini_api_key: apiKey,
        api_key_set: true 
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getAPIKey() {
    try {
      const result = await chrome.storage.sync.get(['gemini_api_key']);
      return result.gemini_api_key || null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  static async hasAPIKey() {
    const apiKey = await this.getAPIKey();
    return !!apiKey;
  }

  static async removeAPIKey() {
    try {
      await chrome.storage.sync.remove(['gemini_api_key', 'api_key_set']);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Chat History Management
  static async saveMessage(profileHash, role, content) {
    try {
      const result = await chrome.storage.local.get(['chats']);
      const chats = result.chats || {};

      if (!chats[profileHash]) {
        chats[profileHash] = {
          profile: {},
          messages: [],
          lastActive: new Date().toISOString()
        };
      }

      chats[profileHash].messages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        timestamp: new Date().toISOString()
      });

      chats[profileHash].lastActive = new Date().toISOString();

      // Chat history is now persistent - no message limit
      // Messages can only be deleted from the settings page

      await chrome.storage.local.set({ chats });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getChatHistory(profileHash) {
    try {
      const result = await chrome.storage.local.get(['chats']);
      const chats = result.chats || {};
      return chats[profileHash] || null;
    } catch (error) {
      console.error('Error getting chat history:', error);
      return null;
    }
  }

  static async updateProfile(profileHash, profileData) {
    try {
      const result = await chrome.storage.local.get(['chats']);
      const chats = result.chats || {};

      if (!chats[profileHash]) {
        chats[profileHash] = {
          profile: {},
          messages: [],
          lastActive: new Date().toISOString()
        };
      }

      chats[profileHash].profile = {
        ...profileData,
        scrapedAt: new Date().toISOString()
      };

      await chrome.storage.local.set({ chats });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async clearChatHistory(profileHash) {
    try {
      const result = await chrome.storage.local.get(['chats']);
      const chats = result.chats || {};

      if (chats[profileHash]) {
        delete chats[profileHash];
        await chrome.storage.local.set({ chats });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async exportChatHistory() {
    try {
      const result = await chrome.storage.local.get(['chats']);
      return result.chats || {};
    } catch (error) {
      console.error('Error exporting chat history:', error);
      return {};
    }
  }

  // Settings Management
  static async saveSetting(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getSetting(key, defaultValue = null) {
    try {
      const result = await chrome.storage.sync.get([key]);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      console.error('Error getting setting:', error);
      return defaultValue;
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}

