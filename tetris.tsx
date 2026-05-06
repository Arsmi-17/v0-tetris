"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Music, Pause, Play, VolumeX } from "lucide-react"
import { Geist } from "next/font/google"
import Image from "next/image"

const geist = Geist({ subsets: ["latin"] })

const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]], color: "cyan-500" },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "blue-500",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "orange-500",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "yellow-500",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "green-500",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "purple-500",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "red-500",
  },
}

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const BUFFER_ROWS = 2 // Invisible rows above the visible board
const TOTAL_BOARD_HEIGHT = BOARD_HEIGHT + BUFFER_ROWS
const INITIAL_DROP_TIME = 800
const SPEED_INCREASE_FACTOR = 0.8 // Changed from 0.95 to 0.8 for more dramatic speed increase

// Create board with buffer rows (total 22 rows, but only show bottom 20)
const createEmptyBoard = () => Array.from({ length: TOTAL_BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0))

const randomTetromino = () => {
  const keys = Object.keys(TETROMINOS)
  const randKey = keys[Math.floor(Math.random() * keys.length)]
  return TETROMINOS[randKey]
}

const generateNextPieces = (count = 3) => {
  return Array.from({ length: count }, () => randomTetromino())
}

export default function Tetris() {
  const [board, setBoard] = useState(createEmptyBoard())
  const [currentPiece, setCurrentPiece] = useState(null)
  const [nextPieces, setNextPieces] = useState(generateNextPieces())
  const [heldPiece, setHeldPiece] = useState(null)
  const [canHold, setCanHold] = useState(true)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [dropTime, setDropTime] = useState(INITIAL_DROP_TIME)
  const [level, setLevel] = useState(1)
  const [isMusicPlaying, setIsMusicPlaying] = useState(true)
  const [completedRows, setCompletedRows] = useState([])
  const audioRef = useRef(null)
  const gameStateRef = useRef({
    board,
    currentPiece,
    gameOver,
    isPaused,
  })

  useEffect(() => {
    gameStateRef.current = { board, currentPiece, gameOver, isPaused }
  }, [board, currentPiece, gameOver, isPaused])

  const checkCollision = useCallback(
    (x, y, shape, currentBoard = board) => {
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col] !== 0) {
            const newX = x + col
            const newY = y + row

            if (newX < 0 || newX >= BOARD_WIDTH) {
              return true
            }

            if (newY >= TOTAL_BOARD_HEIGHT) {
              return true
            }

            if (newY >= 0 && currentBoard[newY][newX] !== 0) {
              return true
            }
          }
        }
      }
      return false
    },
    [board],
  )

  const isValidMove = useCallback(
    (x, y, shape, currentBoard = board) => {
      return !checkCollision(x, y, shape, currentBoard)
    },
    [checkCollision],
  )

  const checkGameOver = useCallback((currentBoard) => {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (currentBoard[BUFFER_ROWS][x] !== 0) {
        return true
      }
    }
    return false
  }, [])

  const holdPiece = useCallback(() => {
    if (!canHold || !currentPiece) return

    if (heldPiece) {
      const newPiece = {
        x: Math.floor(BOARD_WIDTH / 2) - 1,
        y: 0,
        tetromino: heldPiece,
      }

      if (!isValidMove(newPiece.x, newPiece.y, newPiece.tetromino.shape)) {
        setGameOver(true)
        return
      }

      setHeldPiece(currentPiece.tetromino)
      setCurrentPiece(newPiece)
    } else {
      setHeldPiece(currentPiece.tetromino)
      spawnNewPiece()
    }
    setCanHold(false)
  }, [currentPiece, heldPiece, canHold, isValidMove])

  const moveLeft = useCallback(() => {
    if (currentPiece && !isPaused && isValidMove(currentPiece.x - 1, currentPiece.y, currentPiece.tetromino.shape)) {
      setCurrentPiece((prev) => ({ ...prev, x: prev.x - 1 }))
    }
  }, [currentPiece, isPaused, isValidMove])

  const moveRight = useCallback(() => {
    if (currentPiece && !isPaused && isValidMove(currentPiece.x + 1, currentPiece.y, currentPiece.tetromino.shape)) {
      setCurrentPiece((prev) => ({ ...prev, x: prev.x + 1 }))
    }
  }, [currentPiece, isPaused, isValidMove])

  const moveDown = useCallback(() => {
    if (!currentPiece || isPaused) return
    if (isValidMove(currentPiece.x, currentPiece.y + 1, currentPiece.tetromino.shape)) {
      setCurrentPiece((prev) => ({ ...prev, y: prev.y + 1 }))
    } else {
      placePiece()
    }
  }, [currentPiece, isPaused, isValidMove])

  const rotate = useCallback(() => {
    if (!currentPiece || isPaused) return
    const rotated = currentPiece.tetromino.shape[0].map((_, i) =>
      currentPiece.tetromino.shape.map((row) => row[i]).reverse(),
    )
    const newX = currentPiece.x
    const newY = currentPiece.y

    const wallKickOffsets = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [-1, -1],
      [1, -1],
    ]

    for (const [offsetX, offsetY] of wallKickOffsets) {
      const testX = newX + offsetX
      const testY = newY + offsetY

      if (isValidMove(testX, testY, rotated)) {
        setCurrentPiece((prev) => ({
          ...prev,
          x: testX,
          y: testY,
          tetromino: { ...prev.tetromino, shape: rotated },
        }))
        return
      }
    }
  }, [currentPiece, isPaused, isValidMove])

  const hardDrop = useCallback(() => {
    if (!currentPiece || isPaused) return

    let dropY = currentPiece.y
    while (isValidMove(currentPiece.x, dropY + 1, currentPiece.tetromino.shape)) {
      dropY++
    }

    if (isValidMove(currentPiece.x, dropY, currentPiece.tetromino.shape)) {
      const droppedPiece = { ...currentPiece, y: dropY }
      placePieceAtPosition(droppedPiece)
    }
  }, [currentPiece, isPaused, isValidMove])

  const placePieceAtPosition = useCallback(
    (piece) => {
      const newBoard = board.map((row) => [...row])
      let validPlacement = true

      piece.tetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const boardY = y + piece.y
            const boardX = x + piece.x

            if (boardY >= 0 && boardY < TOTAL_BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              if (newBoard[boardY][boardX] === 0) {
                newBoard[boardY][boardX] = piece.tetromino.color
              } else {
                validPlacement = false
              }
            } else {
              validPlacement = false
            }
          }
        })
      })

      if (validPlacement) {
        setBoard(newBoard)
        setCurrentPiece(null)

        if (checkGameOver(newBoard)) {
          setGameOver(true)
          return
        }

        clearLines(newBoard)
        setCanHold(true)
        spawnNewPiece()
      } else {
        setGameOver(true)
      }
    },
    [board, checkGameOver],
  )

  const placePiece = useCallback(() => {
    if (!currentPiece) return
    placePieceAtPosition(currentPiece)
  }, [currentPiece, placePieceAtPosition])

  const clearLines = useCallback(
    (newBoard) => {
      const linesCleared = []
      const updatedBoard = []

      for (let i = 0; i < TOTAL_BOARD_HEIGHT; i++) {
        const row = newBoard[i]
        if (i >= BUFFER_ROWS && row.every((cell) => cell !== 0)) {
          linesCleared.push(i)
        } else {
          updatedBoard.push([...row])
        }
      }

      if (linesCleared.length > 0) {
        setCompletedRows(linesCleared.map((row) => row - BUFFER_ROWS))
        setTimeout(() => {
          while (updatedBoard.length < TOTAL_BOARD_HEIGHT) {
            updatedBoard.unshift(Array(BOARD_WIDTH).fill(0))
          }
          setBoard(updatedBoard)
          setCompletedRows([])

          const newScore = score + linesCleared.length * 100
          const newLines = lines + linesCleared.length
          setScore(newScore)
          setLines(newLines)
          setHighScore((prev) => Math.max(prev, newScore))

          if (Math.floor(newLines / 10) > level - 1) {
            setLevel((prev) => prev + 1)
            setDropTime((prev) => Math.max(prev * SPEED_INCREASE_FACTOR, 50))
          }
        }, 500)
      }
    },
    [score, lines, level],
  )

  const spawnNewPiece = useCallback(() => {
    setNextPieces((prevNextPieces) => {
      const newPiece = {
        x: Math.floor(BOARD_WIDTH / 2) - 1,
        y: 0,
        tetromino: prevNextPieces[0],
      }

      const updatedNextPieces = [...prevNextPieces.slice(1), randomTetromino()]

      if (checkCollision(newPiece.x, newPiece.y, newPiece.tetromino.shape)) {
        setGameOver(true)
      } else {
        setCurrentPiece(newPiece)
      }

      return updatedNextPieces
    })
  }, [checkCollision])

  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  useEffect(() => {
    if (!currentPiece && !gameOver) {
      spawnNewPiece()
    }
  }, [currentPiece, gameOver, spawnNewPiece])

  useEffect(() => {
    let interval = null

    if (!gameOver && !isPaused) {
      interval = setInterval(() => {
        const {
          currentPiece: piece,
          board: currentBoard,
          gameOver: isGameOver,
          isPaused: paused,
        } = gameStateRef.current

        if (isGameOver || paused || !piece) return

        const canMoveDown = !checkCollision(piece.x, piece.y + 1, piece.tetromino.shape, currentBoard)

        if (canMoveDown) {
          setCurrentPiece((prev) => (prev ? { ...prev, y: prev.y + 1 } : null))
        } else {
          placePieceAtPosition(piece)
        }
      }, dropTime)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [gameOver, isPaused, dropTime, checkCollision, placePieceAtPosition])

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (gameOver) return
      switch (e.key) {
        case "ArrowLeft":
          moveLeft()
          break
        case "ArrowRight":
          moveRight()
          break
        case "ArrowDown":
          moveDown()
          break
        case "ArrowUp":
          rotate()
          break
        case " ":
          e.preventDefault()
          hardDrop()
          break
        case "p":
        case "P":
          togglePause()
          break
        case "h":
        case "H":
          holdPiece()
          break
        default:
          break
      }
    }
    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [moveLeft, moveRight, moveDown, rotate, gameOver, holdPiece])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3
      audioRef.current.loop = true
      if (!gameOver && isMusicPlaying && !isPaused) {
        audioRef.current.play().catch((error) => console.error("Audio playback failed:", error))
      } else {
        audioRef.current.pause()
      }
    }
  }, [gameOver, isMusicPlaying, isPaused])

  const resetGame = () => {
    setBoard(createEmptyBoard())
    setCurrentPiece(null)
    setNextPieces(generateNextPieces())
    setHeldPiece(null)
    setCanHold(true)
    setScore(0)
    setLines(0)
    setGameOver(false)
    setIsPaused(false)
    setDropTime(INITIAL_DROP_TIME)
    setLevel(1)
    setCompletedRows([])
  }

  const renderCell = (x, y) => {
    const actualY = y + BUFFER_ROWS

    if (
      currentPiece &&
      currentPiece.tetromino.shape[actualY - currentPiece.y] &&
      currentPiece.tetromino.shape[actualY - currentPiece.y][x - currentPiece.x]
    ) {
      return currentPiece.tetromino.color
    }
    return board[actualY][x]
  }

  const renderPiece = (tetromino, size = 20) => {
    if (!tetromino) return null
    return (
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${tetromino.shape[0].length}, 1fr)`,
        }}
      >
        {tetromino.shape.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${y}-${x}`}
              className={`${cell ? `bg-${tetromino.color}` : "bg-transparent"}`}
              style={{ width: size, height: size }}
            />
          )),
        )}
      </div>
    )
  }

  const toggleMusic = () => {
    setIsMusicPlaying(!isMusicPlaying)
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen p-4 bg-gray-200 ${geist.className}`}>
      <div className="mb-8">
        <Image src="/tetris-logo.png" alt="Tetris Logo" width={300} height={80} priority className="drop-shadow-lg" />
      </div>

      <div className="flex gap-8 items-start">
        <div className="flex flex-col gap-4">
          <div className="bg-white p-3 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold mb-2 text-center">Hold</h3>
            <div className="w-20 h-16 rounded flex items-center justify-center bg-slate-200">
              {renderPiece(heldPiece, 15)}
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg shadow-lg">
            <div className="space-y-2">
              <div>
                <h4 className="font-bold">Highscore</h4>
                <div className="p-1 rounded text-center bg-slate-200 text-black">{highScore}</div>
              </div>
              <div>
                <h4 className="font-bold">Level</h4>
                <div className="p-1 rounded text-center bg-slate-200 text-black">{level}</div>
              </div>
              <div>
                <h4 className="font-bold">Score</h4>
                <div className="p-1 rounded text-center bg-slate-200 text-black">{score}</div>
              </div>
              <div>
                <h4 className="font-bold">Lines</h4>
                <div className="p-1 rounded text-center bg-slate-200 text-black">{lines}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div
              className="grid bg-gray-300"
              style={{
                gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
                width: `${BOARD_WIDTH * 25}px`,
                height: `${BOARD_HEIGHT * 25}px`,
                border: "1px solid #e5e7eb",
              }}
            >
              {Array.from({ length: BOARD_HEIGHT }, (_, y) =>
                Array.from({ length: BOARD_WIDTH }, (_, x) => (
                  <AnimatePresence key={`${y}-${x}`}>
                    <motion.div
                      initial={false}
                      animate={{
                        opacity: completedRows.includes(y) ? 0 : 1,
                        scale: completedRows.includes(y) ? 1.1 : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className={`w-6 h-6 ${renderCell(x, y) ? `bg-${renderCell(x, y)}` : "bg-gray-100"}`}
                      style={{ border: "1px solid #e5e7eb" }}
                    />
                  </AnimatePresence>
                )),
              )}
            </div>
          </div>

          <div className="h-12 flex items-center justify-center mt-4">
            {gameOver && <div className="text-2xl font-bold text-red-600">Game Over!</div>}
            {isPaused && !gameOver && <div className="text-2xl font-bold text-blue-600">Paused</div>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white p-3 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold mb-2 text-center">Next</h3>
            <div className="space-y-3">
              {nextPieces.slice(0, 3).map((piece, index) => (
                <div key={index} className="w-20 h-16 rounded flex items-center justify-center bg-slate-200">
                  {renderPiece(piece, 15)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 right-4 flex justify-between items-end">
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <h3 className="text-lg font-bold mb-3 text-center text-gray-800">Controls</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 px-2 py-1 rounded text-xs font-mono min-w-[60px] flex items-center justify-center">
                <Image src="/arrow-keys.png" alt="Arrow Keys" width={40} height={30} className="object-contain" />
              </div>
              <span className="text-gray-700">Move/Rotate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 px-2 py-1 rounded text-xs font-mono min-w-[60px] text-center">SPACE</div>
              <span className="text-gray-700">Hard drop</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 px-2 py-1 rounded text-xs font-mono min-w-[60px] text-center">H</div>
              <span className="text-gray-700">Hold piece</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 px-2 py-1 rounded text-xs font-mono min-w-[60px] text-center">P</div>
              <span className="text-gray-700">Pause</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={togglePause} size="sm" className="bg-gray-800 hover:bg-gray-700">
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          <Button onClick={toggleMusic} size="sm" className="bg-gray-800 hover:bg-gray-700">
            {isMusicPlaying ? <Music className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button onClick={resetGame} size="sm" className="bg-gray-800 hover:bg-gray-700">
            {gameOver ? "Play Again" : "Reset"}
          </Button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Tetris-kxnh5j7hpNEcFspAndlU2huV5n6dvk.mp3"
      />
    </div>
  )
}
