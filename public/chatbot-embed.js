(function () {
  "use strict";

  // Configuration
  const CHATBOT_API_URL =
    "https://fitment-bot-git-dashboard-vick-kumars-projects-381a9899.vercel.app"; // Replace with your actual URL

  // Create container for chatbot
  const container = document.createElement("div");
  container.id = "kansei-chatbot-container";
  document.body.appendChild(container);

  // Load the chatbot iframe
  const iframe = document.createElement("iframe");
  iframe.src = CHATBOT_API_URL + "/chatbot-embed";
  iframe.style.cssText = `
    position: fixed;
    bottom: 0;
    right: 0;
    width: 100px;
    height: 100px;
    border: none;
    z-index: 999999;
    background: transparent;
    transition: width 0.3s, height 0.3s;
  `;
  iframe.setAttribute("id", "kansei-chatbot-iframe");

  container.appendChild(iframe);

  // Listen for messages from the chatbot
  window.addEventListener("message", function (event) {
    // Security: verify origin matches your app
    if (event.origin !== CHATBOT_API_URL) {
      return;
    }

    if (event.data && event.data.type === "chatbot") {
      if (event.data.isOpen) {
        // Chat is open - make iframe large
        iframe.style.width = "100%";
        iframe.style.height = "100%";
      } else {
        // Chat is closed - make iframe small
        iframe.style.width = "100px";
        iframe.style.height = "100px";
      }
    }
  });
})();
