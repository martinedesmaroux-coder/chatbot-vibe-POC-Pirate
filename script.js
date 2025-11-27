// Configuration
const WEBHOOK_URL = 'https://hook.eu1.make.com/hnafrokq43x9kb3ls450r4fw7injhdgi';
let lastPayload = null; // Dernier payload envoyé (pour debug / copie)
let debugPayloadPre = null; // Élément <pre> pour le payload (pour debug)

// Génération d'ID unique
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Variables globales
let chatbotName = 'La Pâtisserie des Brotteaux';
let clientName = '';  // Nom du client par défaut
let conversationId = Math.floor(Date.now() * Math.random()).toString();  // ID numérique unique
let messageCounter = 0;  // Compteur de messages
const MAX_EMPTY_BODY_RETRIES = 1;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

document.addEventListener('DOMContentLoaded', async () => {
    // --- Éléments du DOM ---
    const chatBox = document.getElementById('chatBox');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const debugToggle = document.getElementById('debugToggle');
    const debugPanel = document.getElementById('debugPanel');
    const debugStatus = document.getElementById('debugStatus');
    const debugContentType = document.getElementById('debugContentType');
    const debugHeaders = document.getElementById('debugHeaders');
    const debugBody = document.getElementById('debugBody');
    const copyPayloadBtn = document.getElementById('copyPayloadBtn');
    debugPayloadPre = document.getElementById('debugPayload'); // Assignation de la variable globale
    const inputHelperText = document.querySelector('.input-helper-text');
    const clientNameDisplay = document.querySelector('[data-client-name-display="true"]');
    const clientNameInput = document.getElementById('clientNameInput');
    const validateNameBtn = document.getElementById('validateNameBtn');
    const nameInputSection = document.querySelector('.name-input-section');
    
    // --- Événements ---
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (debugToggle) {
        debugToggle.addEventListener('click', () => {
            const isHidden = debugPanel.hasAttribute('hidden');
            debugPanel.hidden = !isHidden;
            debugToggle.textContent = isHidden ? 'Masquer debug' : 'Afficher debug';
            debugToggle.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
        });
    }
    
    if (clientNameInput && validateNameBtn) {
        // Activer le bouton "Valider" seulement si du texte est présent
        clientNameInput.addEventListener('input', () => {
            validateNameBtn.disabled = !clientNameInput.value.trim();
        });
        
        // Logique du clic sur le bouton "Valider"
        validateNameBtn.addEventListener('click', () => {
            const nameValue = clientNameInput.value.trim();
            if (nameValue) {
                startChat(nameValue);
            }
        });
        
        // Permettre de valider avec la touche "Entrée"
        clientNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Empêche le rechargement de la page
                validateNameBtn.click(); // Simule un clic sur le bouton
            }
        });
        
        // Activer le bouton "Envoyer" uniquement si du texte est présent
        messageInput.addEventListener('input', () => {
            if (messageInput.value.trim() !== '') {
                if (sendBtn) {
                    sendBtn.disabled = false;
                }
            } else {
                if (sendBtn) {
                    sendBtn.disabled = true;
                }
            }
        });
    }
    
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
    
    // Initialise le calendrier
    renderCalendar(new Date(2025, 10, 5)); // Initialise le calendrier en Novembre 2025

});

/**
 * Démarre le chat en utilisant un nom de client.
 * @param {string} nameValue Le nom du client à utiliser.
 */
function startChat(nameValue) {
    const messageInput = document.getElementById('messageInput');
    const nameInputSection = document.querySelector('.name-input-section');

    clientName = nameValue;

    // Activer la zone de saisie de message
    messageInput.disabled = false;
    messageInput.placeholder = 'Écrivez votre message...';

    // Masquer la section de saisie du nom
    if (nameInputSection) nameInputSection.hidden = true;

    // Afficher le premier message de l'utilisateur de manière progressive
    const firstMessage = "Bonjour, je voudrais passer une commande.";
    displayProgressively(firstMessage, 'ai');
    messageInput.focus();
}

/**
 * Met à jour le panneau de debug avec les informations de la requête
 */
function setDebugInfo(status, contentType, headers, body) {
    const debugStatus = document.getElementById('debugStatus');
    const debugContentType = document.getElementById('debugContentType');
    const debugHeaders = document.getElementById('debugHeaders');
    const debugBody = document.getElementById('debugBody');
    
    if (debugStatus) debugStatus.textContent = status;
    if (debugContentType) debugContentType.textContent = contentType;
    if (debugHeaders) debugHeaders.textContent = JSON.stringify(headers, null, 2);
    if (debugBody) debugBody.textContent = body;
}

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
                clientName: clientName,
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
                    const clientNameDisplay = document.querySelector('[data-client-name-display="true"]');
                    if (clientNameDisplay) clientNameDisplay.dataset.clientName = clientName;
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
 * Envoie le nom du client à Make lors de la validation
 */
async function sendInitToMake(clientName) {
    try {
        // Effectuer un appel POST initial pour envoyer le nom du client
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversationId: conversationId,
                messageId: '0',
                clientName: clientName,
                chatbotName: chatbotName,
                action: 'init',
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            console.warn('sendInitToMake: réponse non OK', response.status, response.statusText);
        }
        
    } catch (error) {
        console.warn('Impossible d\'envoyer le nom du client à Make:', error);
    }
}

/**
 * Affiche l'indicateur de frappe
 */
function showTypingIndicator() {
    const chatBox = document.getElementById('chatBox');
    const typingId = 'typing-' + Date.now();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = typingId;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble typing-indicator';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    bubble.innerHTML = '<div class="dot-flashing"></div>';
    
    typingDiv.appendChild(bubble);
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return typingId;
}

/**
 * Envoie un message au webhook Make
 */
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
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
        // Récupérer le contenu de la zone de texte des notes
        const notesText = document.getElementById('notesTextarea').value;
        messageCounter++; // Incrémente le compteur pour chaque nouveau message

        // Préparer le payload afin de pouvoir le réutiliser pour un retry
        const payload = {
            conversationId: conversationId,
            messageId: messageCounter,
            clientName: clientName, // Le nom est déjà défini
            chatbotName: chatbotName,
            action: 'message',
            message: message,
            timestamp: new Date().toISOString(),
            note: notesText // Ajout des notes
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
        
        // Déterminer la réponse à afficher : priorité au texte brut, puis JSON.reply
        let replyText = null;

        // 1. Si on a du texte brut (réponse directe de Make)
        if (text && text.trim().length > 0) {
            replyText = text.trim();
        }
        // 2. Sinon, chercher dans data.reply (format JSON)
        else if (data && typeof data.reply === 'string') {
            replyText = data.reply;
        }
        // 3. Sinon, chercher dans data.candidates (format Gemini)
        else if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            replyText = data.candidates[0].content.parts[0].text;
        }
        
        if (replyText) {
            removeTypingIndicator(typingId);
            await displayProgressively(replyText, 'ai');
        } else {
            console.error('Impossible d\'extraire une réponse. Données reçues :', data, text);
            removeTypingIndicator(typingId);
            addMessage('❌ Erreur : impossible d\'extraire une réponse de Make. Voir la console pour les détails.', 'ai');
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
 * Nettoie le HTML pour éviter les injections de code malveillant
 */
function sanitizeHTML(html) {
    // Créer un élément temporaire
    const temp = document.createElement('div');
    temp.textContent = html;
    
    // Autoriser uniquement certaines balises sûres
    const allowedTags = ['h3', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'p', 'strong', 'span', 'br'];
    const cleaned = temp.innerHTML;
    
    // Vérifier si le contenu contient des balises HTML
    if (/<[a-z][\s\S]*>/i.test(html)) {
        // C'est du HTML, on le retourne tel quel (Make est la source de confiance)
        return html;
    }
    
    // Sinon, c'est du texte brut, on l'échappe
    return cleaned;
}

/**
 * Ajoute un message au chat
 */
function addMessage(text, type) {
    const chatBox = document.getElementById('chatBox');
    const bubble = document.createElement('div');
    bubble.className = type === 'user' ? 'message user' : 'message ai';
    
    const content = document.createElement('div');
    content.className = 'bubble';
    
    if (type === 'user') {
        content.textContent = text;
    } else {
        // Si le texte contient du HTML (détecté par la présence de balises)
        if (text.includes('<') && text.includes('>')) {
            // Afficher directement le HTML complet
            content.innerHTML = text;
        } else {
            // Pour le texte simple, on l'affiche directement aussi (pas d'effet de frappe ici)
            content.textContent = text;
        }
    }
    
    bubble.appendChild(content);
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
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
 * Affiche la réponse progressivement (lettre par lettre) ou directement si HTML
 */
async function displayProgressively(text, sender) {
    const chatBox = document.getElementById('chatBox');
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
    
    messageDiv.appendChild(bubble);
    chatBox.appendChild(messageDiv);
    
    // Afficher les IDs dans la console pour le suivi
    console.log(`Message ID: ${messageId}`);
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`Chatbot Name: ${chatbotName}`);
    
    // Si c'est du HTML (détecté par la présence de balises)
    if (text.includes('<') && text.includes('>')) {
        // Afficher directement le HTML complet
        bubble.innerHTML = text;
        chatBox.scrollTop = chatBox.scrollHeight;
    } else {
        // Effet de frappe pour texte simple
        const speed = 20;
        for (let i = 0; i < text.length; i++) {
            bubble.textContent += text[i];
            chatBox.scrollTop = chatBox.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, speed));
        }
    }
}

/**
 * Affiche un calendrier pour un mois et une année donnés.
 * @param {Date} date La date indiquant le mois et l'année à afficher.
 */
function renderCalendar(date) {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) {
        console.error("L'élément #calendar-container est introuvable.");
        return;
    }

    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const dayNames = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0=Dimanche, 1=Lundi...
    const totalDays = lastDayOfMonth.getDate();

    // Le HTML est généré à l'intérieur d'une carte pour correspondre au style existant
    let html = `
        <div class="info-card full-width">
            <h3>Calendrier</h3>
            <div class="calendar-header">
                <span class="calendar-month-year">${monthNames[month]} ${year}</span>
            </div>
            <table>
                <thead>
                    <tr>${dayNames.map(day => `<th>${day}</th>`).join('')}</tr>
                </thead>
                <tbody>
    `;

    let day = 1;
    for (let i = 0; i < 6; i++) { // 6 lignes max pour un mois
        html += '<tr>';
        for (let j = 0; j < 7; j++) {
            if ((i === 0 && j < firstDayOfWeek) || day > totalDays) {
                html += '<td></td>';
            } else {
                html += `<td>${day}</td>`;
                day++;
            }
        }
        html += '</tr>';
        if (day > totalDays) break; // Sortir si tous les jours sont placés
    }

    html += '</tbody></table></div>';
    calendarContainer.innerHTML = html;
}