import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const GRID_SIZE = 10;
const INITIAL_PLAYER = { x: 0, y: 0, team: "player", color: "#ec4899" };
const BLUE_BOT = { id: "blue", x: 9, y: 0, team: "bot-blue", color: "#60a5fa" };
const LIME_BOT = { id: "lime", x: 0, y: 9, team: "bot-lime", color: "#ccff00" };
const ORANGE_BOT = { id: "orange", x: 9, y: 9, team: "bot-orange", color: "#f97316" };

function GameBoard() {
  const [grid, setGrid] = useState(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
  );
  const [player, setPlayer] = useState(INITIAL_PLAYER);
  const [bots, setBots] = useState([BLUE_BOT, LIME_BOT, ORANGE_BOT]);
  const [paralyzedBots, setParalyzedBots] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isPlayerParalyzed, setIsPlayerParalyzed] = useState(false);
  const [blueBotSpeed, setBlueBotSpeed] = useState(750);
  const [winner, setWinner] = useState(null);
  const moveDirection = useRef(null);
  const playerMoveInterval = useRef(null);
  const botIntervals = useRef({});

  const calculateScores = () => {
    const scores = { player: 0, "bot-blue": 0, "bot-lime": 0, "bot-orange": 0 };
    grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell && scores[cell.owner] !== undefined) {
          scores[cell.owner] += cell.strength;
        }
      });
    });
    return scores;
  };

  const scores = calculateScores();

  useEffect(() => {
    if (gameOver) {
      const entries = Object.entries(scores);
      const maxScore = Math.max(...entries.map(([_, score]) => score));
      const winningEntries = entries.filter(([_, score]) => score === maxScore);

      if (winningEntries.length === 1) {
        setWinner(winningEntries[0][0]);
      } else {
        setWinner("draw");
      }
    }
  }, [gameOver]);

  const paintCell = (x, y, color, id) => {
    if ((id === "player" && isPlayerParalyzed) || (id.startsWith("bot") && paralyzedBots.includes(id))) return;
    setGrid((prev) => {
      const copy = prev.map((row) => [...row]);
      const cell = copy[y][x];
      if (!cell) {
        copy[y][x] = { color, strength: 1, owner: id };
      } else if (cell.owner === id && cell.color === color) {
        const newStrength = Math.min(cell.strength + 1, 2);
        copy[y][x] = { color, strength: newStrength, owner: id };
      } else if (cell.strength === 1 && cell.owner !== id) {
        copy[y][x] = null;
      } else if (cell.strength < 2) {
        copy[y][x] = { color, strength: 1, owner: id };
      }
      return copy;
    });
  };

  useEffect(() => {
    if (gameStarted) {
      paintCell(player.x, player.y, player.color, "player");
      bots.forEach((bot) => {
        paintCell(bot.x, bot.y, bot.color, bot.id);
      });
    }
  }, [gameStarted]);

  const movePlayer = (dx, dy) => {
    if (isPlayerParalyzed || (dx !== 0 && dy !== 0)) return;
    setPlayer((prev) => {
      if (isPlayerParalyzed) return prev;
      const newX = Math.min(Math.max(prev.x + dx, 0), GRID_SIZE - 1);
      const newY = Math.min(Math.max(prev.y + dy, 0), GRID_SIZE - 1);
      paintCell(newX, newY, prev.color, "player");
      return { ...prev, x: newX, y: newY };
    });
  };

  const getClosestBotInRange = (range = 4) => {
    let closestBot = null;
    let minDist = Infinity;
    bots.forEach((bot) => {
      const dx = bot.x - player.x;
      const dy = bot.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range && dist < minDist) {
        closestBot = bot;
        minDist = dist;
      }
    });
    return closestBot;
  };

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const moveBot = (botId) => {
      setBots((prevBots) =>
        prevBots.map((bot) => {
          if (bot.id !== botId || paralyzedBots.includes(bot.id)) return bot;

          const possibleMoves = [];
          if (bot.x > 0) possibleMoves.push({ dx: -1, dy: 0 });
          if (bot.x < GRID_SIZE - 1) possibleMoves.push({ dx: 1, dy: 0 });
          if (bot.y > 0) possibleMoves.push({ dx: 0, dy: -1 });
          if (bot.y < GRID_SIZE - 1) possibleMoves.push({ dx: 0, dy: 1 });

          if (possibleMoves.length === 0) return bot;

          const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
          const newX = Math.min(Math.max(bot.x + move.dx, 0), GRID_SIZE - 1);
          const newY = Math.min(Math.max(bot.y + move.dy, 0), GRID_SIZE - 1);
          paintCell(newX, newY, bot.color, bot.id);
          return { ...bot, x: newX, y: newY };
        })
      );
    };

    botIntervals.current.blue = setInterval(() => moveBot("blue"), blueBotSpeed);
    botIntervals.current.lime = setInterval(() => moveBot("lime"), 750);
    botIntervals.current.orange = setInterval(() => moveBot("orange"), 750);

    const boostInterval = setInterval(() => {
      setBlueBotSpeed(250);
      setTimeout(() => setBlueBotSpeed(750), 3000);
    }, 5000);

    playerMoveInterval.current = setInterval(() => {
      if (moveDirection.current === "ArrowUp") movePlayer(0, -1);
      else if (moveDirection.current === "ArrowDown") movePlayer(0, 1);
      else if (moveDirection.current === "ArrowLeft") movePlayer(-1, 0);
      else if (moveDirection.current === "ArrowRight") movePlayer(1, 0);
    }, 750);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          Object.values(botIntervals.current).forEach(clearInterval);
          clearInterval(playerMoveInterval.current);
          clearInterval(boostInterval);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const cooldownTimer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);

    return () => {
      Object.values(botIntervals.current).forEach(clearInterval);
      clearInterval(playerMoveInterval.current);
      clearInterval(timer);
      clearInterval(cooldownTimer);
      clearInterval(boostInterval);
    };
  }, [gameStarted, gameOver, blueBotSpeed, paralyzedBots]);

  const handleKeyDown = (e) => {
    const validKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (validKeys.includes(e.key)) moveDirection.current = e.key;

    if ((e.key === "q" || e.key === "Q") && cooldown === 0) {
      const closestBot = getClosestBotInRange(4);
      if (closestBot) {
        clearInterval(botIntervals.current[closestBot.id]);
        setParalyzedBots([closestBot.id]);
        setTimeout(() => {
          setParalyzedBots([]);
          botIntervals.current[closestBot.id] = setInterval(() => {
            setBots((prevBots) =>
              prevBots.map((bot) => {
                if (bot.id !== closestBot.id) return bot;
                const possibleMoves = [];
                if (bot.x > 0) possibleMoves.push({ dx: -1, dy: 0 });
                if (bot.x < GRID_SIZE - 1) possibleMoves.push({ dx: 1, dy: 0 });
                if (bot.y > 0) possibleMoves.push({ dx: 0, dy: -1 });
                if (bot.y < GRID_SIZE - 1) possibleMoves.push({ dx: 0, dy: 1 });
                if (possibleMoves.length === 0) return bot;
                const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                const newX = Math.min(Math.max(bot.x + move.dx, 0), GRID_SIZE - 1);
                const newY = Math.min(Math.max(bot.y + move.dy, 0), GRID_SIZE - 1);
                paintCell(newX, newY, bot.color, bot.id);
                return { ...bot, x: newX, y: newY };
              })
            );
          }, closestBot.id === "blue" ? blueBotSpeed : 750);
        }, 3000);
        setCooldown(10);
      }
    }
  };

  const resetGame = () => {
    setGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
    setPlayer(INITIAL_PLAYER);
    setBots([BLUE_BOT, LIME_BOT, ORANGE_BOT]);
    setParalyzedBots([]);
    setTimeLeft(60);
    setGameOver(false);
    setGameStarted(false);
    setCooldown(0);
    setIsPlayerParalyzed(false);
    setWinner(null);
    moveDirection.current = null;
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="w-full h-screen flex flex-col items-center justify-center bg-slate-900"
    >
      {!gameStarted ? (
        <button
          className="bg-pink-500 text-white font-bold px-4 py-2 rounded mb-4"
          onClick={() => setGameStarted(true)}
        >
          Iniciar Jogo
        </button>
      ) : (
        <>
          <div className="flex items-start justify-between w-full max-w-xl text-white mb-4 px-4">
            <div className="text-xl font-bold">⏱️ Tempo restante: {timeLeft}s</div>
            <div className="text-right text-sm leading-5">
              <div style={{ color: player.color }}>Você: {scores.player}</div>
              <div style={{ color: BLUE_BOT.color }}>Bot Azul: {scores["bot-blue"]}</div>
              <div style={{ color: LIME_BOT.color }}>Bot Verde: {scores["bot-lime"]}</div>
              <div style={{ color: ORANGE_BOT.color }}>Bot Laranja: {scores["bot-orange"]}</div>
              <div className="mt-1">❄️ Cooldown: {cooldown}s</div>
            </div>
          </div>
        </>
      )}

      <div className="relative grid mt-4" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 40px)` }}>
        {grid.flatMap((row, y) =>
          row.map((cell, x) => (
            <motion.div
              key={`${x}-${y}`}
              className="w-10 h-10 border border-slate-700"
              style={{ backgroundColor: cell ? cell.color : "#f1f5f9", opacity: cell?.strength === 1 ? 0.5 : 1 }}
            />
          ))
        )}
        <motion.div
          className="absolute w-10 h-10 rounded-full border-2 border-white"
          style={{ backgroundColor: player.color, opacity: isPlayerParalyzed ? 0.5 : 1 }}
          animate={{ x: player.x * 40, y: player.y * 40 }}
          transition={{ type: "spring", stiffness: 300 }}
        />
        {bots.map((bot) => (
          <motion.div
            key={bot.id}
            className={`absolute w-10 h-10 rounded-full border-2 ${paralyzedBots.includes(bot.id) ? "border-red-700" : "border-black"}`}
            style={{ backgroundColor: bot.color, opacity: paralyzedBots.includes(bot.id) ? 0.5 : 1 }}
            animate={{ x: bot.x * 40, y: bot.y * 40 }}
            transition={{ type: "spring", stiffness: 100 }}
          />
        ))}
      </div>

      {gameOver && (
        <div className="mt-6 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">🏁 Fim de Jogo</h2>
          {winner === "draw" ? (
            <p>Empate entre jogadores!</p>
          ) : (
            <p>Vitória de: {winner === "player" ? "Você" : winner.replace("bot-", "Bot ")}</p>
          )}
          <p>Você: {scores.player} | Azul: {scores["bot-blue"]} | Verde: {scores["bot-lime"]} | Laranja: {scores["bot-orange"]}</p>
          <button
            onClick={resetGame}
            className="mt-4 px-4 py-2 bg-white text-slate-900 font-bold rounded"
          >
            Jogar Novamente
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return <GameBoard />;
}
