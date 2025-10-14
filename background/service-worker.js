// LinkedIn AI Premium Extension - Background Service Worker
// Handles Gemini API communication

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GEMINI_REQUEST') {
    handleGeminiRequest(request.apiKey, request.message)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep message channel open for async response
  }
});

async function handleGeminiRequest(apiKey, message) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: message
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

    return { text };
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

// Handle streaming responses (for future enhancement)
async function handleGeminiStreamRequest(apiKey, message) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: message
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(jsonStr);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
              // Send incremental updates to content script
              chrome.tabs.sendMessage(sender.tab.id, {
                type: 'GEMINI_STREAM_CHUNK',
                text: text
              });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return { text: fullText };
  } catch (error) {
    console.error('Gemini Streaming Error:', error);
    throw error;
  }
}

// Store chat history
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SAVE_CHAT') {
    saveChatHistory(request.profileHash, request.message)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

async function saveChatHistory(profileHash, message) {
  const result = await chrome.storage.local.get(['chats']);
  const chats = result.chats || {};
  
  if (!chats[profileHash]) {
    chats[profileHash] = {
      messages: [],
      profile: {},
      lastActive: new Date().toISOString()
    };
  }
  
  chats[profileHash].messages.push({
    id: `msg_${Date.now()}`,
    role: message.role,
    content: message.content,
    timestamp: new Date().toISOString()
  });
  
  chats[profileHash].lastActive = new Date().toISOString();
  
  await chrome.storage.local.set({ chats });
}

// Clean up old chats (90 days)
async function cleanupOldChats() {
  const result = await chrome.storage.local.get(['chats']);
  const chats = result.chats || {};
  const now = new Date();
  const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 90));
  
  Object.keys(chats).forEach(key => {
    const chat = chats[key];
    const lastActive = new Date(chat.lastActive);
    if (lastActive < ninetyDaysAgo) {
      delete chats[key];
    }
  });
  
  await chrome.storage.local.set({ chats });
}

// Run cleanup on extension install/update
chrome.runtime.onInstalled.addListener(() => {
  cleanupOldChats();
});

// Run cleanup daily
setInterval(cleanupOldChats, 24 * 60 * 60 * 1000);

