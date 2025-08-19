// --- GESTIÓN DE SONIDO ---
const sounds = {
    spin: new Audio('https://cdn.freesound.org/previews/66/66717_931657-lq.mp3'),
    win: new Audio('https://cdn.freesound.org/previews/333/333329_5884639-lq.mp3'),
    bonus: new Audio('https://cdn.freesound.org/previews/270/270319_5123851-lq.mp3')
};

export function playSound(soundName) {
    const sound = sounds[soundName];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(error => {
            console.warn(`Advertencia de audio: El navegador bloqueó la reproducción de '${soundName}'. Esto es normal.`);
        });
    }
}

// --- FUNCIONES DE LA INTERFAZ DE USUARIO (UI) ---
export function updateUI(currentBalance, currentFreeSpins, message = "", duration = 3000) {
    const balanceDisplay = document.getElementById('balance-display');
    const freeSpinsDisplay = document.getElementById('free-spins-display');
    const messageDisplay = document.getElementById('message-display');

    if (balanceDisplay) balanceDisplay.textContent = currentBalance.toFixed(2);
    if (freeSpinsDisplay) freeSpinsDisplay.textContent = currentFreeSpins;

    if (messageDisplay && message) {
        messageDisplay.textContent = message;
        messageDisplay.classList.remove('hidden');
        setTimeout(() => {
            if (messageDisplay.textContent === message) {
                messageDisplay.classList.add('hidden');
                messageDisplay.textContent = "";
            }
        }, duration);
    } else if (messageDisplay) {
        messageDisplay.classList.add('hidden');
    }
}

export function highlightWinningSymbols(winningLines, PAYLINES) {
    clearHighlights();
    winningLines.forEach(lineInfo => {
        const linePattern = PAYLINES[lineInfo.line_index];
        for (let i = 0; i < lineInfo.match_count; i++) {
            const row = linePattern[i];
            const symbolDiv = document.getElementById(`symbol-${i}-${row}`);
            if (symbolDiv) {
                symbolDiv.classList.add('winning');
            }
        }
    });
}

export function clearHighlights() {
    document.querySelectorAll('.symbol.winning').forEach(el => el.classList.remove('winning'));
}
