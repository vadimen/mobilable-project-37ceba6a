import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const BOARD_ROWS = 9;
const BOARD_COLS = 9;
const BOARD_MINES = 10;
const MAX_TIMER = 999;

const numberColors = {
  1: '#0000ff',
  2: '#008000',
  3: '#ff0000',
  4: '#000080',
  5: '#800000',
  6: '#008080',
  7: '#000000',
  8: '#808080',
};

const createEmptyBoard = (rows, cols) =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    })),
  );

const getNeighborCoords = (row, col, rows, cols) => {
  const coords = [];
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      const isSelf = r === row && c === col;
      const inBounds = r >= 0 && r < rows && c >= 0 && c < cols;
      if (!isSelf && inBounds) {
        coords.push({ row: r, col: c });
      }
    }
  }
  return coords;
};

const buildBoard = (rows, cols, mines, safeCell) => {
  const board = createEmptyBoard(rows, cols);
  const mineableCells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const isSafe = safeCell && safeCell.row === row && safeCell.col === col;
      if (!isSafe) {
        mineableCells.push({ row, col });
      }
    }
  }

  for (let i = mineableCells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [mineableCells[i], mineableCells[j]] = [mineableCells[j], mineableCells[i]];
  }

  mineableCells.slice(0, mines).forEach(({ row, col }) => {
    board[row][col].isMine = true;
  });

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const neighbors = getNeighborCoords(row, col, rows, cols);
      board[row][col].adjacentMines = neighbors.filter(
        ({ row: nRow, col: nCol }) => board[nRow][nCol].isMine,
      ).length;
    }
  }

  return board;
};

const cloneBoard = board => board.map(row => row.map(cell => ({ ...cell })));

const revealFlood = (board, row, col) => {
  const nextBoard = cloneBoard(board);
  const stack = [{ row, col }];

  while (stack.length) {
    const current = stack.pop();
    const target = nextBoard[current.row][current.col];
    if (target.isRevealed || target.isFlagged) {
      continue;
    }

    target.isRevealed = true;

    if (target.adjacentMines === 0 && !target.isMine) {
      const neighbors = getNeighborCoords(current.row, current.col, nextBoard.length, nextBoard[0].length);
      neighbors.forEach(neighbor => {
        const neighborCell = nextBoard[neighbor.row][neighbor.col];
        if (!neighborCell.isRevealed && !neighborCell.isFlagged && !neighborCell.isMine) {
          stack.push(neighbor);
        }
      });
    }
  }

  return nextBoard;
};

const revealAllMines = board => {
  const nextBoard = cloneBoard(board);
  nextBoard.forEach(row => {
    row.forEach(cell => {
      if (cell.isMine) {
        cell.isRevealed = true;
      }
    });
  });
  return nextBoard;
};

const countFlags = board =>
  board.reduce(
    (total, row) =>
      total + row.reduce((rowTotal, cell) => rowTotal + (cell.isFlagged ? 1 : 0), 0),
    0,
  );

const countRevealedSafeCells = board =>
  board.reduce(
    (total, row) =>
      total +
      row.reduce(
        (rowTotal, cell) => rowTotal + (!cell.isMine && cell.isRevealed ? 1 : 0),
        0,
      ),
    0,
  );

const formatCounter = value => `${Math.min(value, MAX_TIMER)}`.padStart(3, '0');

const formatClockLabel = date => {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  return `${hours12}:${minutes} ${suffix}`;
};

const DigitalDisplay = ({ value }) => (
  <View style={styles.digitalDisplay}>
    <Text style={styles.digitalText}>{value}</Text>
  </View>
);

export default function HomeScreen() {
  const [board, setBoard] = useState(() => createEmptyBoard(BOARD_ROWS, BOARD_COLS));
  const [gameStatus, setGameStatus] = useState('idle');
  const [flagsLeft, setFlagsLeft] = useState(BOARD_MINES);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [firstMove, setFirstMove] = useState(true);
  const [taskbarClock, setTaskbarClock] = useState(() => formatClockLabel(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTaskbarClock(formatClockLabel(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!timerRunning) {
      return undefined;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(prev => Math.min(prev + 1, MAX_TIMER));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning]);

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard(BOARD_ROWS, BOARD_COLS));
    setGameStatus('idle');
    setFlagsLeft(BOARD_MINES);
    setElapsedSeconds(0);
    setTimerRunning(false);
    setFirstMove(true);
  }, []);

  const statusMessage = useMemo(() => {
    if (gameStatus === 'won') {
      return 'You cleared the field!';
    }
    if (gameStatus === 'lost') {
      return 'Boom! Try again.';
    }
    if (firstMove) {
      return 'Left tap to reveal, hold to flag.';
    }
    return 'Careful out there...';
  }, [firstMove, gameStatus]);

  const faceLabel = useMemo(() => {
    if (gameStatus === 'won') {
      return ':D';
    }
    if (gameStatus === 'lost') {
      return 'X('; 
    }
    if (!firstMove) {
      return ':/';
    }
    return ':)';
  }, [firstMove, gameStatus]);

  const handleReveal = (row, col) => {
    const target = board[row][col];
    if (target.isFlagged || target.isRevealed || gameStatus === 'lost' || gameStatus === 'won') {
      return;
    }

    let workingBoard = board;

    if (firstMove) {
      workingBoard = buildBoard(BOARD_ROWS, BOARD_COLS, BOARD_MINES, { row, col });
      setFirstMove(false);
      setTimerRunning(true);
      setGameStatus('playing');
    }

    const activeCell = workingBoard[row][col];

    if (activeCell.isMine) {
      const explodedBoard = revealAllMines(workingBoard);
      setBoard(explodedBoard);
      setGameStatus('lost');
      setTimerRunning(false);
      return;
    }

    const revealedBoard = revealFlood(workingBoard, row, col);
    const revealedSafeCells = countRevealedSafeCells(revealedBoard);
    const totalSafeCells = BOARD_ROWS * BOARD_COLS - BOARD_MINES;
    const didWin = revealedSafeCells === totalSafeCells;

    setBoard(revealedBoard);
    setFlagsLeft(BOARD_MINES - countFlags(revealedBoard));

    if (didWin) {
      setGameStatus('won');
      setTimerRunning(false);
    } else {
      setGameStatus(prev => (prev === 'lost' || prev === 'won' ? prev : 'playing'));
    }
  };

  const handleToggleFlag = (row, col) => {
    const target = board[row][col];
    if (target.isRevealed || gameStatus === 'lost' || gameStatus === 'won') {
      return;
    }

    const nextBoard = cloneBoard(board);
    const cell = nextBoard[row][col];

    if (cell.isFlagged) {
      cell.isFlagged = false;
    } else if (countFlags(board) < BOARD_MINES) {
      cell.isFlagged = true;
    }

    setBoard(nextBoard);
    setFlagsLeft(BOARD_MINES - countFlags(nextBoard));
  };

  const handleStartPress = () => {
    Alert.alert(
      'Start Menu',
      'Windows 95 theme engaged. Connect your Supabase account to unlock cloud features!',
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.desktop}>
        <View style={styles.windowShadow}>
          <View style={styles.window}>
            <View style={styles.titleBar}>
              <Text style={styles.titleText}>Minesweeper</Text>
              <View style={styles.titleButtons}>
                <View style={styles.titleButton}>
                  <Text style={styles.titleButtonText}>_</Text>
                </View>
                <View style={styles.titleButton}>
                  <Text style={styles.titleButtonText}>[]</Text>
                </View>
                <View style={[styles.titleButton, styles.closeButton]}>
                  <Text style={styles.closeButtonText}>X</Text>
                </View>
              </View>
            </View>

            <View style={styles.windowContent}>
              <View style={styles.infoRow}>
                <DigitalDisplay value={formatCounter(flagsLeft)} />
                <TouchableOpacity
                  accessibilityHint="Tap to start a new game"
                  accessibilityLabel="Reset game"
                  style={styles.faceButton}
                  onPress={resetGame}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faceText}>{faceLabel}</Text>
                </TouchableOpacity>
                <DigitalDisplay value={formatCounter(elapsedSeconds)} />
              </View>

              <View style={styles.board}>
                {board.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.boardRow}>
                    {row.map((cell, colIndex) => {
                      const revealed = cell.isRevealed;
                      const cellStyles = [styles.cell];
                      if (revealed) {
                        cellStyles.push(styles.cellRevealed);
                      }
                      if (revealed && cell.isMine) {
                        cellStyles.push(styles.cellMine);
                      }

                      const displayValue = (() => {
                        if (!revealed && cell.isFlagged) {
                          return 'F';
                        }
                        if (!revealed) {
                          return '';
                        }
                        if (cell.isMine) {
                          return '*';
                        }
                        return cell.adjacentMines || '';
                      })();

                      return (
                        <Pressable
                          key={`cell-${rowIndex}-${colIndex}`}
                          onPress={() => handleReveal(cell.row, cell.col)}
                          onLongPress={() => handleToggleFlag(cell.row, cell.col)}
                          delayLongPress={200}
                          style={({ pressed }) => [
                            ...cellStyles,
                            !revealed && pressed ? styles.cellPressed : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.cellText,
                              typeof displayValue === 'number'
                                ? { color: numberColors[displayValue] }
                                : null,
                              cell.isMine && revealed ? styles.mineText : null,
                              !revealed && cell.isFlagged ? styles.flagText : null,
                            ]}
                          >
                            {displayValue}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.statusBar}>
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.taskbar}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartPress}
          activeOpacity={0.6}
        >
          <View style={styles.startButtonAccent} />
          <Text style={styles.startText}>Start</Text>
        </TouchableOpacity>
        <View style={styles.taskbarSpacer}>
          <Text style={styles.taskbarHint}>Minesweeper</Text>
        </View>
        <View style={styles.systemTray}>
          <Text style={styles.systemTrayText}>{taskbarClock}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#008080',
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 0,
  },
  desktop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windowShadow: {
    backgroundColor: '#00000044',
    paddingTop: 4,
    paddingLeft: 4,
  },
  window: {
    backgroundColor: '#c0c0c0',
    borderColor: '#ffffff',
    borderWidth: 2,
    width: '95%',
    maxWidth: 360,
  },
  titleBar: {
    backgroundColor: '#000080',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  titleText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  titleButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleButton: {
    width: 20,
    height: 18,
    borderWidth: 1,
    borderColor: '#808080',
    backgroundColor: '#c0c0c0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  titleButtonText: {
    fontSize: 10,
    color: '#000000',
  },
  closeButton: {
    backgroundColor: '#ff0000',
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  windowContent: {
    padding: 10,
    borderColor: '#808080',
    borderWidth: 2,
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  digitalDisplay: {
    width: 60,
    height: 32,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#808080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitalText: {
    color: '#ff0000',
    fontSize: 20,
    fontWeight: 'bold',
  },
  faceButton: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: '#808080',
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c0c0c0',
  },
  faceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  board: {
    borderWidth: 2,
    borderColor: '#808080',
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
  },
  boardRow: {
    flexDirection: 'row',
  },
  cell: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: '#808080',
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c0c0c0',
  },
  cellPressed: {
    borderTopColor: '#808080',
    borderLeftColor: '#808080',
    borderBottomColor: '#ffffff',
    borderRightColor: '#ffffff',
  },
  cellRevealed: {
    backgroundColor: '#b9b9b9',
    borderColor: '#808080',
    borderTopColor: '#808080',
    borderLeftColor: '#808080',
  },
  cellMine: {
    backgroundColor: '#ffaaaa',
  },
  cellText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  mineText: {
    color: '#000000',
  },
  flagText: {
    color: '#ff0000',
  },
  statusBar: {
    marginTop: 10,
    padding: 6,
    backgroundColor: '#d9d9d9',
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRightColor: '#808080',
    borderBottomColor: '#808080',
  },
  statusText: {
    color: '#000000',
    fontSize: 13,
  },
  taskbar: {
    height: 46,
    backgroundColor: '#c0c0c0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderTopWidth: 2,
    borderTopColor: '#808080',
    borderBottomWidth: 2,
    borderBottomColor: '#ffffff',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#c0c0c0',
    borderWidth: 2,
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    borderBottomColor: '#808080',
    borderRightColor: '#808080',
    marginRight: 8,
  },
  startButtonAccent: {
    width: 10,
    height: 10,
    backgroundColor: '#008000',
    marginRight: 6,
  },
  startText: {
    fontWeight: 'bold',
    color: '#000000',
    fontSize: 16,
  },
  taskbarSpacer: {
    flex: 1,
    height: '100%',
    borderWidth: 2,
    borderTopColor: '#808080',
    borderLeftColor: '#808080',
    borderBottomColor: '#ffffff',
    borderRightColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  taskbarHint: {
    color: '#000000',
    fontSize: 14,
  },
  systemTray: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    borderBottomColor: '#808080',
    borderRightColor: '#808080',
    backgroundColor: '#c0c0c0',
  },
  systemTrayText: {
    fontWeight: 'bold',
    color: '#000000',
  },
});
