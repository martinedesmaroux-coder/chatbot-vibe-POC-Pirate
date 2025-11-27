document.addEventListener('DOMContentLoaded', () => {
    // --- SÉLECTION DES ÉLÉMENTS DU DOM ---
    const chatBox = document.getElementById('chatBox');
    const clientNameInput = document.getElementById('clientNameInput');
    const validateNameBtn = document.getElementById('validateNameBtn');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatbotTitle = document.getElementById('chatbotTitle');
    const debugToggle = document.getElementById('debugToggle');
    const debugPanel = document.getElementById('debugPanel');
    const inputHelperText = document.querySelector('.input-helper-text');
    const copyPayloadBtn = document.getElementById('copyPayloadBtn');
    const notesTextarea = document.getElementById('notesTextarea');

    let lastPayload = {}; // Pour stocker le dernier payload envoyé

    // --- GESTION DE LA VALIDATION DU NOM ---

    // Active/désactive le bouton "Valider" en fonction du contenu du champ
    function updateValidateButtonState() {
        validateNameBtn.disabled = clientNameInput.value.trim() === '';
    }

    // Met à jour le bouton à chaque saisie dans le champ du nom
    clientNameInput.addEventListener('input', updateValidateButtonState);

    // Gère le clic sur le bouton "Valider"
    validateNameBtn.addEventListener('click', () => {
        const clientName = clientNameInput.value.trim();

        if (clientName) {
            // Stocke le nom pour une utilisation ultérieure (par exemple, dans le titre)
            chatbotTitle.dataset.clientName = clientName;

            // Envoie le nom du client à Make
            sendInitToMake(clientName);

            // Désactive le champ de nom et le bouton "Valider"
            clientNameInput.disabled = true;
            validateNameBtn.disabled = true;


            // Active la zone de saisie des messages
            messageInput.disabled = false;
            messageInput.placeholder = 'Écrivez votre message ici...';


            messageInput.focus(); // Met le focus sur le champ de message
        }
    });

    // --- GESTION DE L'ENVOI DES MESSAGES ---

    // Active/désactive le bouton "Envoyer"
    function updateSendButtonState() {
        sendBtn.disabled = messageInput.value.trim() === '' || messageInput.disabled;
    }

    // Met à jour le bouton à chaque saisie dans le champ de message
    messageInput.addEventListener('input', updateSendButtonState);

    // Fonction pour envoyer un message
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText) {
            // Ajoute le message de l'utilisateur à la boîte de chat
            addMessage(messageText, 'user');
            messageInput.value = '';
            updateSendButtonState();

            // Affiche l'indicateur de frappe
            showTypingIndicator();

            // Simule une réponse de l'IA après un court délai
            setTimeout(() => {
                hideTypingIndicator();
                addMessage("Ceci est une réponse simulée de l'IA.", 'ai');
            }, 1500);
        }
    }

    // Gère le clic sur le bouton "Envoyer"
    sendBtn.addEventListener('click', sendMessage);

    // Gère l'appui sur la touche "Entrée" dans le champ de message
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Empêche le saut de ligne
            sendMessage();
        }
    });

    // --- FONCTIONS D'INITIALISATION ---

    // Envoie le nom du client à Make lors de la validation
    async function sendInitToMake(clientName) {
        const WEBHOOK_URL = 'https://hook.eu1.make.com/hnafrokq43x9kb3ls450r4fw7injhdgi';

        try {
            // Effectuer un appel POST initial pour envoyer le nom du client
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversationId: 1234567890,
                    messageId: 0,
                    clientName: clientName,
                    chatbotName: "La Pâtisserie des Brotteaux",
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
     * Affiche la réponse progressivement (lettre par lettre) ou directement si HTML
     */
    async function displayProgressively(text, sender) {
        const chatBox = document.getElementById('chatBox');
        const messageCounter = 1;
        const messageId = `${1234567890}-msg-${messageCounter}`;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.id = messageId;
        messageDiv.setAttribute('data-message-id', messageId);
        messageDiv.setAttribute('data-conversation-id', 1234567890);
        messageDiv.setAttribute('data-chatbot-name', "La Pâtisserie des Brotteaux");
        messageDiv.setAttribute('data-timestamp', new Date().toISOString());

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        messageDiv.appendChild(bubble);
        chatBox.appendChild(messageDiv);

        // Afficher les IDs dans la console pour le suivi
        console.log(`Message ID: ${messageId}`);
        console.log(`Conversation ID: ${1234567890}`);
        console.log(`Chatbot Name: ${"La Pâtisserie des Brotteaux"}`);

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

    // Ajoute un message à la boîte de chat
    function addMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);

        const bubbleElement = document.createElement('div');
        bubbleElement.classList.add('bubble');
        bubbleElement.textContent = text;

        messageElement.appendChild(bubbleElement);
        chatBox.appendChild(messageElement);

        // Fait défiler vers le bas pour voir le nouveau message
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // --- INITIALISATION ---
    updateValidateButtonState();
    updateSendButtonState();

    // Initialise le calendrier
    //renderCalendar(new Date(2025, 10, 5)); // Initialise le calendrier en Novembre 2025

    // --- FONCTIONS D'AFFICHAGE DANS LE CHAT ---

    // Ajoute un message à la boîte de chat
    function addMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);
        
        const bubbleElement = document.createElement('div');
        bubbleElement.classList.add('bubble');
        bubbleElement.textContent = text;
        
        messageElement.appendChild(bubbleElement);
        chatBox.appendChild(messageElement);
        
        // Fait défiler vers le bas pour voir le nouveau message
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Affiche l'indicateur "en train d'écrire"
    function showTypingIndicator() {
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'ai');
        typingIndicator.id = 'typingIndicator';
        typingIndicator.innerHTML = `
            <div class="typing-indicator">
                <div class="dot-flashing"></div>
            </div>
        `;
        chatBox.appendChild(typingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Masque l'indicateur "en train d'écrire"
    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
});