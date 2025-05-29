// Injected script - runs in page context to intercept responses
(function() {
    console.log('Response Interceptor loaded');

    // Store original fetch function
    const originalFetch = window.fetch;

    // Override fetch function
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch.apply(this, args);
            
            // Clone the response so we can read it without consuming it
            const clonedResponse = response.clone();
            
            // Check if this is a ChatGPT API response
            if (response.url.includes('api.openai.com') || 
                response.url.includes('chatgpt.com') ||
                response.headers.get('content-type')?.includes('application/json')) {
                
                try {
                    const responseData = await clonedResponse.json();
                    const modifiedData = interceptResponse(responseData);
                    
                    // Create a new response with modified data
                    const modifiedResponse = new Response(JSON.stringify(modifiedData), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                    
                    // Dispatch custom event
                    window.dispatchEvent(new CustomEvent('intercepted-response', {
                        detail: { original: responseData, modified: modifiedData }
                    }));
                    
                    return modifiedResponse;
                } catch (e) {
                    console.log('Not JSON response or failed to parse:', e);
                }
            }
            
            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    };

    // Function to modify response content
    function interceptResponse(data) {
        // Deep clone the data to avoid modifying the original
        const modifiedData = JSON.parse(JSON.stringify(data));
        
        // Function to recursively search and modify text content
        function modifyContent(obj) {
            if (typeof obj === 'string') {
                // Add [Intercepted] to the end of responses
                return obj + '[Intercepted]';
            } else if (Array.isArray(obj)) {
                return obj.map(item => modifyContent(item));
            } else if (obj && typeof obj === 'object') {
                const result = {};
                for (const key in obj) {
                    // Common keys that contain response text in ChatGPT API
                    if (key === 'content' || key === 'text' || key === 'message' || key === 'response') {
                        result[key] = modifyContent(obj[key]);
                    } else {
                        result[key] = modifyContent(obj[key]);
                    }
                }
                return result;
            }
            return obj;
        }
        
        return modifyContent(modifiedData);
    }

    // Also intercept WebSocket messages for real-time chat
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        const originalAddEventListener = ws.addEventListener;
        ws.addEventListener = function(type, listener, options) {
            if (type === 'message') {
                const wrappedListener = function(event) {
                    try {
                        const data = JSON.parse(event.data);
                        const modifiedData = interceptResponse(data);
                        
                        // Create new event with modified data
                        const modifiedEvent = new MessageEvent('message', {
                            data: JSON.stringify(modifiedData),
                            origin: event.origin,
                            lastEventId: event.lastEventId,
                            source: event.source,
                            ports: event.ports
                        });
                        
                        listener.call(this, modifiedEvent);
                    } catch (e) {
                        // If not JSON, pass through original
                        listener.call(this, event);
                    }
                };
                originalAddEventListener.call(this, type, wrappedListener, options);
            } else {
                originalAddEventListener.call(this, type, listener, options);
            }
        };
        
        return ws;
    };

    // Intercept XMLHttpRequest as well
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._url = url;
        return originalXHROpen.apply(this, [method, url, ...args]);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        const originalOnReadyStateChange = xhr.onreadystatechange;
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                    const responseData = JSON.parse(xhr.responseText);
                    const modifiedData = interceptResponse(responseData);
                    
                    // Override response properties
                    Object.defineProperty(xhr, 'responseText', {
                        writable: true,
                        value: JSON.stringify(modifiedData)
                    });
                    Object.defineProperty(xhr, 'response', {
                        writable: true,
                        value: JSON.stringify(modifiedData)
                    });
                } catch (e) {
                    // Not JSON, leave as is
                }
            }
            
            if (originalOnReadyStateChange) {
                originalOnReadyStateChange.apply(this, arguments);
            }
        };
        
        return originalXHRSend.apply(this, arguments);
    };

    console.log('All response interception methods activated');
})();
// Only intercept if it looks like a chat response
if (originalText.trim().length > 0 && 
    !originalText.includes('Ask Gemini') && 
    !originalText.includes('Gemini can make mistakes') &&
    !originalText.includes('Unusual activity') &&
    !originalText.includes('Try again later') &&
    originalText.length > 10) { // Only intercept longer responses
    element.textContent = originalText + '[Intercepted]';
}