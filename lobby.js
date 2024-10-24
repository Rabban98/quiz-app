let username = "";
let lobbyCode = "";
let socket;
let players = [];
let isCreator = false;
let currentQuestionIndex = 0;
let selectedQuestions = [];
let playerScore = 0;
let hasAnswered = false;
const maxQuestions = 25;

function showUsernameInput() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('username-screen').style.display = 'block';
}

function chooseUsername() {
    username = document.getElementById('username-input').value;
    if (username) {
        document.getElementById('username-screen').style.display = 'none';
        document.getElementById('options-screen').style.display = 'block';
    } else {
        alert("Please enter a username!");
    }
}

function goBack() {
    location.reload(); // Ta användaren tillbaka till startskärmen
}

function showJoinLobby() {
    document.getElementById('options-screen').style.display = 'none';
    document.getElementById('join-lobby-screen').style.display = 'block';
}

function createLobby() {
    lobbyCode = generateLobbyCode();
    isCreator = true;
    document.getElementById('options-screen').style.display = 'none';
    document.getElementById('create-lobby-screen').style.display = 'block';
    document.getElementById('lobby-code').textContent = lobbyCode;

    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log("WebSocket connection established, creating lobby:", lobbyCode);
        socket.send(JSON.stringify({ type: 'create', code: lobbyCode, username: username }));
        players.push({ username: username, score: 0, isCreator: true });
        updatePlayersList();
        showStartGameButton();  // Visa "Start Game"-knappen även för en enda spelare
    };

    socket.onmessage = (message) => handleSocketMessage(JSON.parse(message.data));
}

function joinLobby() {
    lobbyCode = document.getElementById('lobby-input').value.toUpperCase();

    if (!lobbyCode) {
        alert("Please enter a valid lobby code!");
        return;
    }

    console.log("Trying to join lobby with code:", lobbyCode);

    document.getElementById('join-lobby-screen').style.display = 'none';
    document.getElementById('create-lobby-screen').style.display = 'block'; // Visa väntskärmen

    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log("WebSocket connection established, joining lobby:", lobbyCode);
        socket.send(JSON.stringify({ type: 'join', code: lobbyCode, username: username }));
    };

    socket.onmessage = (message) => handleSocketMessage(JSON.parse(message.data));

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        alert("Failed to connect to lobby. Please try again.");
        goBack();
    };
}

function handleSocketMessage(data) {
    console.log("Received message from server:", data);

    if (data.type === 'player-joined') {
        players = data.players;
        updatePlayersList();
        showStartGameButton();
    } else if (data.type === 'start-game') {
        startQuiz();
        loadNextQuestion(data.question);
    } else if (data.type === 'timer-update') {
        document.getElementById('timer').textContent = `Time Left: ${data.timeLeft}s`;
    } else if (data.type === 'correct-answer') {
        showCorrectAnswer(data.correct);
    } else if (data.type === 'leaderboard') {
        showLeaderboard(data.players);
        setTimeout(() => {
            document.getElementById('leaderboard-screen').style.display = 'none';
        }, 3000);
    } else if (data.type === 'next-question') {
        document.getElementById('leaderboard-screen').style.display = 'none';
        loadNextQuestion(data.question);
        document.getElementById('quiz-screen').style.display = 'block';
    } else if (data.type === 'game-over') {
        alert("Game Over! Thank you for playing.");
        goBack();
    }
}

function updatePlayersList() {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = ''; // Rensa listan innan den uppdateras

    players.forEach(player => {
        const playerItem = document.createElement('li');
        playerItem.textContent = player.username;

        if (player.isCreator) {
            playerItem.classList.add('lobby-owner');
        }

        playersList.appendChild(playerItem);
    });
}

function showStartGameButton() {
    if (isCreator) {  // Tillåt skaparen att starta spelet även som enda spelare
        document.getElementById('start-game-btn').style.display = 'block';
    } else {
        document.getElementById('start-game-btn').style.display = 'none';
    }
}

function startGame() {
    if (!isCreator) {
        alert("Only the lobby creator can start the game!");
        return;
    }

    fetch('questions.json')
        .then(response => response.json())
        .then(data => {
            socket.send(JSON.stringify({ type: 'start-game', code: lobbyCode, questions: data }));
        })
        .catch(err => console.error("Error loading questions: ", err));
}

function startQuiz() {
    currentQuestionIndex = 0;
    document.getElementById('create-lobby-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'block';
}

function loadNextQuestion(question) {
    document.getElementById('question-progress').textContent = `Round ${currentQuestionIndex + 1}/${maxQuestions}`; // Visar rundan
    document.getElementById('question-text').textContent = question.question;
    const answerButtons = document.querySelectorAll('.answer-btn');
    answerButtons.forEach((button, index) => {
        button.textContent = question.answers[index];
        button.classList.remove('correct', 'wrong', 'selected'); // Rensa tidigare val/highlights
        button.style.backgroundColor = ''; // Återställ bakgrundsfärg
        button.disabled = false;
    });
    hasAnswered = false;
}

function submitAnswer(selected) {
    if (hasAnswered) return;
    hasAnswered = true;
    const timeLeft = parseInt(document.getElementById('timer').textContent.replace(/\D/g, '')); // Hämta återstående tid
    socket.send(JSON.stringify({ type: 'player-answered', code: lobbyCode, username: username, selected: selected, timeLeft: timeLeft }));
    const answerButtons = document.querySelectorAll('.answer-btn');
    answerButtons[selected].classList.add('selected'); // Markera valda svaret med vitt
    answerButtons[selected].style.backgroundColor = "#ffffff"; // Ändra bakgrundsfärg till vitt
}

function showCorrectAnswer(correct) {
    const answerButtons = document.querySelectorAll('.answer-btn');
    answerButtons[correct].classList.add('correct'); // Markera rätt svar grönt
    answerButtons.forEach((button, index) => {
        if (!button.classList.contains('correct') && button.classList.contains('selected')) {
            button.classList.add('wrong'); // Markera fel svar rött
        }
        button.disabled = true; // Inaktivera alla knappar
    });
    setTimeout(() => {
        document.getElementById('quiz-screen').style.display = 'none';
        document.getElementById('leaderboard-screen').style.display = 'block';
    }, 2000);
}

function showLeaderboard(players) {
    const leaderboardList = document.getElementById('leaderboard');
    leaderboardList.innerHTML = '';
    players.forEach((player, index) => {
        const playerItem = document.createElement('li');
        playerItem.textContent = `${index + 1}. ${player.username}: ${player.score} points`;
        leaderboardList.appendChild(playerItem);
    });
}

function generateLobbyCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}































