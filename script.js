// Configuration
const WEBHOOK_URL = 'https://hook.eu1.make.com/hnafrokq43x9kb3ls450r4fw7injhdgi';
let lastPayload = null; // Dernier payload envoyé (pour debug / copie)
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
let clientName = 'Madame Martin';  // Nom du client par défaut
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
    const debugPayloadPre = document.getElementById('debugPayload');
    const inputHelperText = document.querySelector('.input-helper-text');
    const clientNameInput = document.getElementById('clientNameInput');
    const validateNameBtn = document.getElementById('validateNameBtn');

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
                clientName = nameValue;

                // 1. Mettre à jour le nom affiché dans l'en-tête
                document.getElementById('clientNameDisplay').textContent = nameValue;

                // 2. Activer la zone de saisie de message
                messageInput.disabled = false;
                
                // 3. Mettre à jour les textes d'aide
                if (inputHelperText) inputHelperText.textContent = 'Écrivez votre message ci-dessous.';
                messageInput.placeholder = 'Écrivez votre message...';

                // 4. Désactiver la section de saisie du nom
                clientNameInput.disabled = true;
                validateNameBtn.disabled = true;
                
                // 5. Envoyer le nom à Make et afficher le premier message
                sendInitToMake(nameValue);
                
                // 6. Mettre le focus sur le champ de message
                messageInput.focus();
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

    // Initialise le calendrier en décembre 2025.
    renderCalendar(new Date('2025-12-01'));
});

// Garde en mémoire la date affichée par le calendrier
let currentCalendarDate = new Date();

/**
 * Génère et affiche un calendrier dynamique.
 * @param {Date} dateToShow La date à utiliser pour afficher le mois correct.
 */
function renderCalendar(dateToShow) {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) return;

    currentCalendarDate = new Date(dateToShow);
    const month = currentCalendarDate.getMonth();
    const year = currentCalendarDate.getFullYear();

    // La date à considérer comme "aujourd'hui" pour la mise en évidence
    const highlightedDate = new Date('2025-12-05');
    // On vérifie si le calendrier affiche le mois et l'année de la date à surligner
    const isHighlightMonth = highlightedDate.getFullYear() === year && highlightedDate.getMonth() === month;

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let startingDay = firstDayOfMonth.getDay();
    startingDay = (startingDay === 0) ? 6 : startingDay - 1; // Lundi = 0, Dimanche = 6

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

    let html = `
        <div class="calendar-header">
            <button id="prev-month-btn" class="calendar-nav-btn">‹</button>
            <h4>${monthNames[month]} ${year}</h4>
            <button id="next-month-btn" class="calendar-nav-btn">›</button>
        </div>
        <div class="calendar-grid">
    `;

    dayNames.forEach(day => {
        html += `<div class="calendar-cell calendar-day-name">${day}</div>`;
    });

    for (let i = 0; i < startingDay; i++) {
        html += `<div class="calendar-cell"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        // Le jour est-il celui à surligner ?
        const isToday = isHighlightMonth && (day === highlightedDate.getDate());
        const dayOfWeek = (new Date(year, month, day).getDay() + 6) % 7; // 0 (Lundi) à 6 (Dimanche)
        const isMonday = dayOfWeek === 0;

        html += `<div class="calendar-cell calendar-date ${isToday ? 'today' : ''} ${isMonday ? 'monday' : ''}">${day}</div>`;
    }

    html += `</div>`;
    calendarContainer.innerHTML = html;

    // --- Logique de navigation ---
    const nextMonthBtn = document.getElementById('next-month-btn');
    const prevMonthBtn = document.getElementById('prev-month-btn');

    // Limite de navigation : 1 an à partir de décembre 2025
    const limitDate = new Date('2025-12-01');
    limitDate.setFullYear(limitDate.getFullYear() + 1);

    // Désactiver le bouton "suivant" si on atteint la limite (Novembre 2026)
    if (currentCalendarDate.getFullYear() === limitDate.getFullYear() && currentCalendarDate.getMonth() === limitDate.getMonth() -1) {
        nextMonthBtn.disabled = true;
    }

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar(currentCalendarDate);
    });

    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar(currentCalendarDate);
    });
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
        
        const welcomeMessage = `Bonjour, je voudrais passer une commande.`;
        addMessage(welcomeMessage, 'ai');
        
    } catch (error) {
        console.warn('Impossible d\'envoyer le nom du client à Make:', error);
    }
}


/**
 * Envoie un message au webhook Make
 */
async function sendMessage() {
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
        // Préparer le payload afin de pouvoir le réutiliser pour un retry
        const payload = {
            conversationId: conversationId,
            messageId: messageCounter.toString(),
            clientName: clientName,
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
