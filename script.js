import { playSound, updateUI, highlightWinningSymbols, clearHighlights } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a Elementos del DOM ---
    const reelsContainer = document.getElementById('reels-container');
    const spinButton = document.getElementById('spin-button');
    const betAmountSelector = document.getElementById('bet-amount');
    const buyBonusButton = document.getElementById('buy-bonus-button');
    const gameContainer = document.getElementById('game-container');
    const splashScreen = document.getElementById('splash-screen');
    const playButton = document.getElementById('play-button');
    const paylineOverlay = document.getElementById('payline-overlay');
    const bonusBuyMenu = document.getElementById('bonus-buy-menu');
    const closeBonusMenuButton = bonusBuyMenu.querySelector('.close-button');
    const buyButtons = bonusBuyMenu.querySelectorAll('.buy-button');
    const priceStandardSpan = document.getElementById('price-standard');
    const priceLegendarySpan = document.getElementById('price-legendary');
    const infoMenu = document.getElementById('info-menu');
    const infoButton = document.getElementById('info-button');
    const closeInfoMenuButton = infoMenu.querySelector('.close-button');
    const paytableContainer = document.getElementById('paytable-container');
    const bonusSummaryScreen = document.getElementById('bonus-summary-screen');
    const closeSummaryButton = document.getElementById('close-summary-button');
    const bonusWinAmountSpan = document.getElementById('bonus-win-amount');
    const bonusSpinsPlayedSpan = document.getElementById('bonus-spins-played');

    // const API_URL = 'http://127.0.0.1:5000';
    const API_URL = 'https://silla-game-backend-584c488ae4e2.herokuapp.com/'
    let currentBalance = 0;
    let currentFreeSpins = 0;
    let PAYLINES = [];
    const SYMBOLS = ['7', '💎', '⭐', '🍉', '🔔', '🍊', '💰', '🤠', 'W'];

    // --- LÓGICA DE INICIO ---
    playButton.addEventListener('click', () => {
        splashScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        initializeGame();
    });

    async function initializeGame() {
        try {
            // Paso 1: Reiniciar el estado en el servidor
            await fetch(`${API_URL}/initialize`, { 
                method: 'POST',
                credentials: 'include' // Necesario para enviar la cookie de sesión
            });

            // Paso 2: Obtener el estado recién inicializado
            const response = await fetch(`${API_URL}/gameState`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Error al conectar con el servidor.');
            const data = await response.json();
            
            currentBalance = data.balance;
            PAYLINES = data.paylines;
            
            betAmountSelector.innerHTML = '';
            data.allowed_bets.forEach(bet => {
                const option = document.createElement('option');
                option.value = bet;
                option.textContent = bet.toFixed(2);
                betAmountSelector.appendChild(option);
            });
            
            createInitialReels();
            updateUI(currentBalance, currentFreeSpins, "¡Selecciona tu apuesta y gira!");
            updateBonusBuyPrices();

        } catch (error) {
            updateUI(currentBalance, currentFreeSpins, "Error de conexión con el servidor.");
        }
    }

    function createInitialReels() {
        reelsContainer.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            const reelDiv = document.createElement('div');
            reelDiv.classList.add('reel');
            for (let j = 0; j < 5; j++) {
                const symbolDiv = document.createElement('div');
                symbolDiv.classList.add('symbol');
                symbolDiv.id = `symbol-${i}-${j}`;
                reelDiv.appendChild(symbolDiv);
            }
            reelsContainer.appendChild(reelDiv);
        }
        reelsContainer.appendChild(paylineOverlay);
    }

    // --- LÓGICA DE GIRO ---
    spinButton.addEventListener('click', () => performSpin());

    async function performSpin() {
        clearHighlights();
        clearPaylines();
        setControlsDisabled(true);
        updateUI(currentBalance, currentFreeSpins, currentFreeSpins > 0 ? `Giro Gratis ${currentFreeSpins}` : "Girando...");
        playSound('spin');

        try {
            const response = await fetch(`${API_URL}/spin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bet: parseFloat(betAmountSelector.value) }),
                credentials: 'include'
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error en el giro');
            }

            const data = await response.json();
            await renderSpinAnimation(data.resultMatrix);
            updateGameState(data);

        } catch (error) {
            updateUI(currentBalance, currentFreeSpins, error.message);
        }
    }

    function updateGameState(data) {
        console.log("--- ACTUALIZANDO ESTADO DEL JUEGO ---");
        console.log("Datos recibidos del servidor:", data);
        
        currentBalance = data.newBalance;
        currentFreeSpins = data.freeSpinsRemaining;

        if (data.winningLines && data.winningLines.length > 0) {
            highlightWinningSymbols(data.winningLines, PAYLINES);
            drawPaylines(data.winningLines);
            updateUI(currentBalance, currentFreeSpins, `¡Ganaste $${data.totalPrize.toFixed(2)}!`);
            playSound('win');
        } else {
            updateUI(currentBalance, currentFreeSpins, "No hubo suerte.");
        }

        if (data.freeSpinsWon > 0) {
            updateUI(currentBalance, currentFreeSpins, `¡Ganaste ${data.freeSpinsWon} Giros Gratis!`, 3000);
            playSound('bonus');
        }
        if (data.retriggerMessage) {
            updateUI(currentBalance, currentFreeSpins, data.retriggerMessage, 3000);
            playSound('bonus');
        }
        if (data.bonus_summary) {
            showBonusSummary(data.bonus_summary);
        }

        // --- Lógica de Autoplay para Giros Gratis ---
        if (data.freeSpinsRemaining > 0) {
            // Si todavía quedan giros gratis, espera un segundo y gira de nuevo automáticamente.
            setTimeout(() => performSpin(), 1500);
        } else {
            // Si no quedan giros gratis, la ronda ha terminado. Habilita los controles.
            setControlsDisabled(false);
        }
    }
    
    function createSymbolDiv(cellData) {
        const symbolDiv = document.createElement('div');
        symbolDiv.classList.add('symbol');
        symbolDiv.textContent = cellData.symbol;
    
        if (cellData.symbol === 'W') {
            symbolDiv.classList.add('symbol-wild');
        }
        return symbolDiv;
    }

    async function renderSpinAnimation(resultMatrix) {
    const reels = reelsContainer.querySelectorAll('.reel');
    const animationPromises = [];

    reels.forEach((reel, reelIndex) => {
        const symbolContainer = document.createElement('div');
        symbolContainer.classList.add('reel-symbols-container');
        
        for (let i = 0; i < 30; i++) {
            symbolContainer.appendChild(createSymbolDiv({ symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] }));
        }

        resultMatrix[reelIndex].forEach(symbolStr => {
            symbolContainer.appendChild(createSymbolDiv({symbol: symbolStr}));
        });

        reel.innerHTML = '';
        reel.appendChild(symbolContainer);

        const animationPromise = new Promise(resolve => {
            requestAnimationFrame(() => {
                symbolContainer.style.transition = 'transform 2s cubic-bezier(0.25, 0.1, 0.25, 1)';
                symbolContainer.style.transform = `translateY(-${(30) * reel.clientHeight / 5}px)`;
            });
            setTimeout(() => {
                // Al finalizar, reconstruimos el contenido del carrete con los divs finales y sus IDs
                reel.innerHTML = ''; // Limpiamos el contenedor de animación
                resultMatrix[reelIndex].forEach((symbolStr, rowIndex) => {
                    const symbolDiv = createSymbolDiv({symbol: symbolStr});
                    symbolDiv.id = `symbol-${reelIndex}-${rowIndex}`; // Asignamos el ID
                    reel.appendChild(symbolDiv);
                });
                resolve();
            }, 2000 + reelIndex * 100);
        });
        animationPromises.push(animationPromise);
    });

    await Promise.all(animationPromises);
    // Ya no se necesita llamar a renderFinalGrid, la animación lo maneja todo.
}

    function drawPaylines(winningLines) {
        clearPaylines();
        const symbolWidth = reelsContainer.querySelector('.reel').clientWidth;
        const symbolHeight = reelsContainer.querySelector('.reel').clientHeight / 5;

        for (const lineInfo of winningLines) {
            const linePattern = PAYLINES[lineInfo.line_index];
            const points = linePattern.map((row_idx, reel_idx) => {
                const x = reel_idx * symbolWidth + symbolWidth / 2;
                const y = row_idx * symbolHeight + symbolHeight / 2;
                return `${x},${y}`;
            }).join(' ');

            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('points', points);
            polyline.classList.add('payline');
            paylineOverlay.appendChild(polyline);
        }
    }

    function clearPaylines() {
        paylineOverlay.innerHTML = '';
    }

    function setControlsDisabled(isDisabled) {
        spinButton.disabled = isDisabled;
        buyBonusButton.disabled = isDisabled;
        betAmountSelector.disabled = isDisabled;
    }

    // --- LÓGICA DE MENÚS ---
    buyBonusButton.addEventListener('click', () => {
        updateBonusBuyPrices();
        bonusBuyMenu.classList.remove('hidden');
    });
    closeBonusMenuButton.addEventListener('click', () => bonusBuyMenu.classList.add('hidden'));

    infoButton.addEventListener('click', () => {
        renderPaytable();
        infoMenu.classList.remove('hidden');
    });
    closeInfoMenuButton.addEventListener('click', () => infoMenu.classList.add('hidden'));
    
    closeSummaryButton.addEventListener('click', () => {
        bonusSummaryScreen.classList.add('hidden');
        setControlsDisabled(false);
    });

    betAmountSelector.addEventListener('change', () => {
        updateBonusBuyPrices();
        if (!infoMenu.classList.contains('hidden')) renderPaytable();
    });

    function updateBonusBuyPrices() {
        const bet = parseFloat(betAmountSelector.value);
        priceStandardSpan.textContent = `$${(bet * 100).toFixed(2)}`;
        priceLegendarySpan.textContent = `$${(bet * 300).toFixed(2)}`;
    }
    
    function showBonusSummary(summaryData) {
        bonusWinAmountSpan.textContent = `$${summaryData.total_win.toFixed(2)}`;
        bonusSpinsPlayedSpan.textContent = summaryData.spins_played;
        bonusSummaryScreen.classList.remove('hidden');
        setControlsDisabled(true);
    }

    async function renderPaytable() {
        try {
            const response = await fetch(`${API_URL}/paytable`, {
                credentials: 'include'
            });
            const paytableData = await response.json();
            const currentBet = parseFloat(betAmountSelector.value);

            let tableHTML = '<table><thead><tr><th>Símbolo</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>';
            for (const symbol in paytableData) {
                tableHTML += `<tr><td>${symbol}</td>`;
                for (let i = 3; i <= 7; i++) {
                    const prize = (paytableData[symbol][i] || 0) * currentBet;
                    tableHTML += `<td>$${prize.toFixed(2)}</td>`;
                }
                tableHTML += '</tr>';
            }
            tableHTML += '</tbody></table>';
            paytableContainer.innerHTML = tableHTML;
        } catch (error) {
            paytableContainer.innerHTML = "<p>No se pudo cargar la tabla de pagos.</p>";
        }
    }
    
    buyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const bet = parseFloat(betAmountSelector.value);
            const bonusType = button.dataset.bonusType;
            setControlsDisabled(true);
            bonusBuyMenu.classList.add('hidden');

            try {
                const response = await fetch(`${API_URL}/buyBonus`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bet, bonusType }),
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'No se pudo comprar el bono');
                }
                
                const data = await response.json();
                currentBalance = data.newBalance;
                // La respuesta de buyBonus ahora incluye los giros restantes
                currentFreeSpins = data.freeSpinsRemaining;
                updateUI(currentBalance, currentFreeSpins, data.message);
                
                performSpin();

            } catch (error) {
                updateUI(currentBalance, currentFreeSpins, error.message);
                setControlsDisabled(false);
            }
        });
    });
});