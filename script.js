// Configuration
const WEBHOOK_URL = 'https://hook.eu1.make.com/hnafrokq43x9kb3ls450r4fw7injhdgi';

// Génération d'ID unique
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Éléments du DOM
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const debugToggle = document.getElementById('debugToggle');
const debugPanel = document.getElementById('debugPanel');
const debugStatus = document.getElementById('debugStatus');
const debugContentType = document.getElementById('debugContentType');
const debugHeaders = document.getElementById('debugHeaders');
const debugBody = document.getElementById('debugBody');

// Événements
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Toggle debug panel
if (debugToggle) {
    debugToggle.addEventListener('click', () => {
        const isHidden = debugPanel.hasAttribute('hidden');
        if (isHidden) {
            debugPanel.removeAttribute('hidden');
            debugToggle.textContent = 'Masquer debug';
            debugToggle.setAttribute('aria-pressed', 'true');
        } else {
            debugPanel.setAttribute('hidden', '');
            debugToggle.textContent = 'Afficher debug';
            debugToggle.setAttribute('aria-pressed', 'false');
        }
    });
}

/**
 * Met à jour le panneau de debug
 */
function setDebugInfo(status, contentType, headersObj, bodyText) {
    console.info('Make response:', { status, contentType, headers: headersObj, body: bodyText });
    if (debugStatus) debugStatus.textContent = `${status}`;
    if (debugContentType) debugContentType.textContent = contentType || '-';
    if (debugHeaders) debugHeaders.textContent = JSON.stringify(headersObj || {}, null, 2);
    if (debugBody) debugBody.textContent = bodyText || '-';
}

/**
 * Extrait le texte pertinent depuis un objet de réponse Make (s'il existe)
 */
function extractTextFromData(data) {
    if (!data) return null;
    // chemins probables
    if (typeof data === 'string') return data;
    if (data.response) return data.response;
    if (data.message) return data.message;
    if (data.text) return data.text;
    if (data.body && typeof data.body === 'string') return data.body;
    if (data.output && (data.output.text || data.output[0])) return data.output.text || (Array.isArray(data.output) ? data.output[0] : null);
    if (data.result && (data.result.text || data.result[0])) return data.result.text || (Array.isArray(data.result) ? data.result[0] : null);
    if (data.choices && Array.isArray(data.choices) && data.choices[0] && (data.choices[0].text || data.choices[0].message)) {
        return data.choices.map(c => c.text || c.message || '').join('\n');
    }
    // rechercher récursivement une première propriété string
    try {
        const stack = [data];
        while (stack.length) {
            const node = stack.shift();
            if (!node || typeof node !== 'object') continue;
            for (const k of Object.keys(node)) {
                const v = node[k];
                if (typeof v === 'string' && v.trim().length) return v;
                if (typeof v === 'object') stack.push(v);
            }
        }
    } catch (e) {
        // noop
    }
    return null;
}

// Variables globales
let chatbotName = 'Madame Martin';
let clientName = 'Client';  // Nom du client (à remplir dynamiquement)
let conversationId = Math.floor(Date.now() * Math.random()).toString();  // ID numérique unique
let messageCounter = 0;  // Compteur de messages
const MAX_EMPTY_BODY_RETRIES = 1;

// Dernier payload envoyé (pour debug / copie)
let lastPayload = null;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Copy payload button binding
const copyPayloadBtn = document.getElementById('copyPayloadBtn');
const debugPayloadPre = document.getElementById('debugPayload');
if (copyPayloadBtn) {
    copyPayloadBtn.addEventListener('click', async () => {
        if (!lastPayload) {
            copyPayloadBtn.textContent = 'Aucun payload';
            setTimeout(() => copyPayloadBtn.textContent = 'Copier dernier payload', 1500);
            return;
        }
        try {
            await navigator.clipboard.writeText(JSON.stringify(lastPayload, null, 2));
            copyPayloadBtn.textContent = 'Copié ✅';
            setTimeout(() => copyPayloadBtn.textContent = 'Copier dernier payload', 1500);
        } catch (e) {
            console.warn('Impossible de copier le payload dans le presse-papier', e);
            // fallback: select the pre so user can copy manually
            if (debugPayloadPre) {
                const range = document.createRange();
                range.selectNodeContents(debugPayloadPre);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    });
}

// Message de bienvenue au chargement de la page
window.addEventListener('load', async () => {
    // Récupérer le nom du chatbot depuis Make si configuré
    await initializeChatbot();
    
    const welcomeMessage = `Bonjour, je voudrais passer une commande.`;
    addMessage(welcomeMessage, 'ai');
});

/**
 * Initialise le chatbot en récupérant les données depuis Make
 */
async function initializeChatbot() {
    try {
        // Effectuer un appel POST initial pour récupérer les infos du chatbot
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversationId: conversationId,
                messageId: '0',
                chatbotName: chatbotName,
                action: 'init',
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            // Essayer de parser la réponse proprement, tolérer les réponses non-JSON
            const ct = response.headers.get('content-type') || '';
            let data = null;
            try {
                if (ct.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        // réponse texte non-JSON, on ignore pour l'init
                        console.info('initializeChatbot: réponse non-JSON lors de l\'init', text);
                    }
                }
            } catch (e) {
                console.warn('initializeChatbot: impossible de parser la réponse', e);
            }

            // Adapter selon la structure de votre réponse Make
            if (data) {
                if (data.chatbotName) chatbotName = data.chatbotName;
                if (data.name) chatbotName = data.name;
                if (data.clientName) {
                    clientName = data.clientName;
                    document.getElementById('clientNameDisplay').textContent = clientName;
                }
            }
        } else {
            console.warn('initializeChatbot: réponse non OK', response.status, response.statusText);
        }
    } catch (error) {
        console.warn('Impossible de récupérer les infos du chatbot, utilisation du nom par défaut:', error);
        // Garder le nom par défaut en cas d'erreur
    }
}

/**
 * Envoie un message au webhook Make
 */
async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Vérifier que le webhook URL est configuré
    if (WEBHOOK_URL === 'YOUR_MAKE_WEBHOOK_URL_HERE') {
        alert('⚠️ Veuillez configurer votre URL webhook Make dans script.js');
        return;
    }
    
    // Afficher le message de l'utilisateur
    addMessage(message, 'user');
    messageInput.value = '';
    
    // Désactiver le bouton pendant l'envoi
    sendBtn.disabled = true;
    
    // Afficher l'indicateur "IA est en train d'écrire..."
    const typingId = showTypingIndicator();

    try {
        // Préparer le payload afin de pouvoir le réutiliser pour un retry
        const payload = {
            conversationId: conversationId,
            messageId: messageCounter.toString(),
            chatbotName: chatbotName,
            action: 'message',
            message: message,
            timestamp: new Date().toISOString()
        };

        // Envoyer le message au webhook
        lastPayload = payload; // stocker pour debug/copier
        if (debugPayloadPre) debugPayloadPre.textContent = JSON.stringify(lastPayload, null, 2);
        let response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        const statusText = response.statusText;
        const ct = response.headers.get('content-type') || '';

        // Remplir le panneau de debug headers
        const headersObj = {};
        try { for (const [k, v] of response.headers.entries()) headersObj[k] = v; } catch (e) {}

        // Lire le corps en raw (ArrayBuffer) pour gérer text/plain, JSON, ou contenu non imprimable
        let attempt = 0;
        let buffer = null;
        let text = '';
        let data = null;
        let bodyLength = 0;

        while (true) {
            try {
                buffer = await response.arrayBuffer().catch(() => null);
                bodyLength = buffer ? buffer.byteLength : 0;
                if (buffer) {
                    try { text = new TextDecoder('utf-8').decode(buffer); } catch (e) { text = ''; }
                } else {
                    text = '';
                }

                // tenter JSON si content-type JSON ou si le texte commence par '{' ou '['
                const looksLikeJson = (ct.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('['));
                if (looksLikeJson && text.trim().length > 0) {
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        data = null;
                    }
                }

                // si on a quelque chose d'utile (JSON parsé ou texte non vide) -> sortir
                if ( (data && typeof data === 'object') || (text && text.trim().length > 0) ) break;

                // sinon, si corps vide et tentative possible -> retry
                if (bodyLength === 0 && attempt < MAX_EMPTY_BODY_RETRIES) {
                    attempt++;
                    console.warn(`Réponse vide reçue (attempt ${attempt}). Retente dans 1s...`);
                    setDebugInfo(status, ct, headersObj, '(empty body)');
                    await sleep(1000);
                    response = await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Retry-Attempt': `${attempt}`
                        },
                        body: JSON.stringify(payload)
                    });
                    // mettre à jour headersObj/status/ct
                    try { for (const [k, v] of response.headers.entries()) headersObj[k] = v; } catch (e) {}
                    // update locals
                    bodyLength = 0; text = ''; data = null;
                    continue;
                }

                // si corps non imprimable (length>0 mais text empty) -> afficher info et arrêter
                if (bodyLength > 0 && (!text || !text.trim())) {
                    // transformer en base64 pour affichage
                    let base64 = '';
                    try {
                        const bytes = new Uint8Array(buffer);
                        let binary = '';
                        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                        base64 = btoa(binary);
                    } catch (e) { base64 = '(non-encodable)'; }
                    setDebugInfo(status, ct, headersObj, `(binary body, length ${bodyLength})\nbase64: ${base64}`);
                    console.error('Réponse non-textuelle reçue de Make, bodyLength:', bodyLength);
                    removeTypingIndicator(typingId);
                    addMessage("❌ Erreur : Make a renvoyé un contenu non textuel. Voir debug pour détails.", 'ai');
                    return;
                }

                // si on arrive ici, corps vide ou non-JSON -> afficher message d'erreur
                setDebugInfo(status, ct, headersObj, text || '(empty body)');
                console.error('Erreur: Make n\'a pas renvoyé de JSON ou de texte utile. Statut:', status, statusText, 'Content-Type:', ct, 'bodyLength:', bodyLength);
                removeTypingIndicator(typingId);
                addMessage("❌ Erreur : réponse vide ou non-JSON reçue de Make. Voir la console pour les détails.", 'ai');
                return;
            } catch (err) {
                console.error('Erreur lors de la lecture du body:', err);
                removeTypingIndicator(typingId);
                addMessage('❌ Erreur lors de la lecture de la réponse Make. Voir la console.', 'ai');
                return;
            }
        }

        // Mettre à jour le debug panel avec le texte ou le JSON reçu
        const debugBodyText = data ? JSON.stringify(data, null, 2) : (text || '(empty body)');
        setDebugInfo(status, ct, headersObj, debugBodyText);

        if (!response.ok) {
            console.error('Erreur HTTP reçue de Make:', status, statusText, data || text);
            removeTypingIndicator(typingId);
            addMessage(`❌ Erreur HTTP ${status} reçue de Make. Voir console pour détails.`, 'ai');
            return;
        }

        // Déterminer la réponse à afficher : priorité au JSON.reply, sinon texte brut
        let replyText = null;
        if (data && typeof data.reply === 'string') replyText = data.reply;
        else if (text && text.trim().length > 0) replyText = text.trim();
        
        if (replyText) {
            removeTypingIndicator(typingId);
            await displayProgressively(replyText, 'ai');
        } else {
            console.error('Réponse JSON ne contient pas la propriété "reply" et pas de texte brut :', data, text);
            removeTypingIndicator(typingId);
            addMessage('❌ Erreur : la réponse de Make est vide ou ne contient pas de champ "reply". Voir la console.', 'ai');
        }
    } catch (error) {
        console.error('Erreur sendMessage:', error);
        removeTypingIndicator(typingId);
        // Afficher un message utilisateur plus informatif et le détail dans la console
        addMessage(`❌ Erreur lors de l'envoi du message. Détails: ${error.message}`, 'ai');
    } finally {
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

/**
 * Ajoute un message au chat
 */
function addMessage(text, sender) {
    messageCounter++;
    const messageId = `${conversationId}-msg-${messageCounter}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.id = messageId;
    messageDiv.setAttribute('data-message-id', messageId);
    messageDiv.setAttribute('data-conversation-id', conversationId);
    messageDiv.setAttribute('data-chatbot-name', chatbotName);
    messageDiv.setAttribute('data-timestamp', new Date().toISOString());
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    
    messageDiv.appendChild(bubble);
    chatBox.appendChild(messageDiv);
    
    // Afficher les IDs dans la console pour le suivi
    console.log(`Message ID: ${messageId}`);
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`Chatbot Name: ${chatbotName}`);
    
    // Scroll automatique vers le bas
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Affiche un indicateur "IA est en train d'écrire..."
 */
function showTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.id = 'typing-' + Date.now();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        typingDiv.appendChild(dot);
    }
    
    messageDiv.appendChild(typingDiv);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return messageDiv.id;
}

/**
 * Supprime l'indicateur de frappe
 */
function removeTypingIndicator(typingId) {
    const element = document.getElementById(typingId);
    if (element) {
        element.remove();
    }
}

/**
 * Affiche la réponse progressivement (lettre par lettre)
 */
async function displayProgressively(text, sender) {
    messageCounter++;
    const messageId = `${conversationId}-msg-${messageCounter}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.id = messageId;
    messageDiv.setAttribute('data-message-id', messageId);
    messageDiv.setAttribute('data-conversation-id', conversationId);
    messageDiv.setAttribute('data-chatbot-name', chatbotName);
    messageDiv.setAttribute('data-timestamp', new Date().toISOString());
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = '';
    
    messageDiv.appendChild(bubble);
    chatBox.appendChild(messageDiv);
    
    // Afficher les IDs dans la console pour le suivi
    console.log(`Message ID: ${messageId}`);
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`Chatbot Name: ${chatbotName}`);
    
    // Vitesse d'affichage (en millisecondes)
    const speed = 20;
    
    for (let i = 0; i < text.length; i++) {
        bubble.textContent += text[i];
        
        // Scroll automatique
        chatBox.scrollTop = chatBox.scrollHeight;
        
        // Attendre avant d'ajouter le caractère suivant
        await new Promise(resolve => setTimeout(resolve, speed));
    }
}
