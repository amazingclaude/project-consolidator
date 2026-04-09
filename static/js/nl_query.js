(function() {
  const messagesEl = document.getElementById("chat-messages");
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const examplesList = document.getElementById("examples-list");
  const messages = [];

  function appendMessage(role, content) {
    messages.push({ role, content });
    const div = document.createElement("div");
    div.className = `chat-msg ${role}`;
    div.innerHTML = content.replace(/\n/g, "<br>");
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendQuestion(question) {
    if (!question.trim()) return;
    appendMessage("user", question);
    inputEl.value = "";
    sendBtn.disabled = true;

    const thinkingDiv = document.createElement("div");
    thinkingDiv.className = "chat-msg assistant";
    thinkingDiv.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Analyzing...';
    messagesEl.appendChild(thinkingDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await postJSON("/api/nl-query", { question });
      messagesEl.removeChild(thinkingDiv);
      appendMessage("assistant", res.answer);
    } catch(e) {
      messagesEl.removeChild(thinkingDiv);
      appendMessage("assistant", `Error: ${e.message}`);
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener("click", () => sendQuestion(inputEl.value));
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendQuestion(inputEl.value);
  });

  // Click example to send
  examplesList.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      inputEl.value = e.target.textContent;
      sendQuestion(e.target.textContent);
    }
  });
})();
