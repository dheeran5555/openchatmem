// Content script - acts as a bridge between the page and extension
(function() {
    // Inject the main script into the page context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    // Listen for messages from the injected script
    window.addEventListener('intercepted-response', function(event) {
        console.log('Response intercepted:', event.detail);
    });
})();