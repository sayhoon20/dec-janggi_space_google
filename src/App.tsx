import React, { useState, useEffect, useRef } from 'react';
import { Board, Team, SetupType, MoveRecord, PieceType, GameMode } from './types';
import { initBoard, isValidMove, calculateMaterialScore, generateFen } from './janggiLogic';
import { Download, Play, RotateCcw, Cpu, Activity, Rotate3D, Undo2, Flag, SkipForward } from 'lucide-react';
import { Button } from './components/Button';

// Global declaration for Electron API
declare global {
  interface Window {
    electronAPI?: {
      startEngine: () => void;
      stopEngine: () => void;
      sendCommand: (cmd: string) => void;
      onEngineOutput: (callback: (output: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

const PIECE_CHARS: Record<Team, Record<PieceType, string>> = {
  r: { jang: '漢', cha: '車', po: '包', ma: '馬', sang: '象', sa: '士', jol: '兵' },
  b: { jang: '楚', cha: '車', po: '包', ma: '馬', sang: '象', sa: '士', jol: '卒' }
};

const App: React.FC = () => {
  // Game State
  const [board, setBoard] = useState<Board>([]);
  const [turn, setTurn] = useState<Team>('b'); // b=Cho(Blue), r=Han(Red)
  const [gameStarted, setGameStarted] = useState(false);
  const [redSetup, setRedSetup] = useState<SetupType>('an');
  const [blueSetup, setBlueSetup] = useState<SetupType>('an');
  const [gameMode, setGameMode] = useState<GameMode>('PvP');
  
  // Interactions
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<[number, number][]>([]);
  const [history, setHistory] = useState<MoveRecord[]>([]);
  const [isFlipped, setIsFlipped] = useState(false); // View Flip
  
  // Scores
  const [materialScore, setMaterialScore] = useState({ red: 0, blue: 0 });
  const [engineScore, setEngineScore] = useState<string>("0.00");
  
  // Engine Control
  const [engineEnabled, setEngineEnabled] = useState(false);
  const [timeControl, setTimeControl] = useState<number>(6); // seconds
  const isEngineThinking = useRef(false);

  // --- Effects ---

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.startEngine();
      window.electronAPI.onEngineOutput((output) => {
        // Parse Score
        if (output.includes('score cp')) {
          const match = output.match(/score cp (-?\d+)/);
          if (match) {
            // cp is usually centipawns. Divide by 100 for pawn units.
            // Stockfish perspective: Positive = Engine winning (or Side to move winning)
            // Fairy Stockfish for Janggi usually outputs score relative to side to move or white?
            // Let's assume absolute score (positive = white/red advantage, negative = black/blue).
            // Actually standard UCI 'cp' is usually "side to move".
            // For simplicity, we display raw value first.
            const raw = parseInt(match[1], 10);
            setEngineScore((raw / 100).toFixed(2));
          }
        }
        if (output.includes('score mate')) {
            const match = output.match(/score mate (-?\d+)/);
            if (match) setEngineScore(`Mate ${match[1]}`);
        }

        // Parse Best Move
        if (output.startsWith('bestmove')) {
          isEngineThinking.current = false;
          const parts = output.split(' ');
          const moveStr = parts[1];
          if (moveStr && moveStr !== '(none)') {
             applyEngineMove(moveStr);
          }
        }
      });
    }

    return () => {
      if (window.electronAPI) window.electronAPI.removeAllListeners('engine-output');
    };
  }, []);

  useEffect(() => {
    if (gameStarted) {
      setMaterialScore(calculateMaterialScore(board));
      checkEngineMove();
    }
  }, [board, turn, gameStarted, engineEnabled]);

  // --- Engine Logic ---

  const checkEngineMove = () => {
    if (!engineEnabled || !gameStarted || isEngineThinking.current) return;

    let shouldEngineMove = false;
    
    // Determine if it's engine's turn based on mode
    if (gameMode === 'CvC') shouldEngineMove = true;
    else if (gameMode === 'PvC' && turn === 'r') shouldEngineMove = true; // User is Blue(Cho), Engine is Red(Han)
    else if (gameMode === 'CvP' && turn === 'b') shouldEngineMove = true; // User is Red(Han), Engine is Blue(Cho)
    
    if (shouldEngineMove) {
      requestEngineMove();
    }
  };

  const requestEngineMove = () => {
    if (!window.electronAPI) return;
    isEngineThinking.current = true;
    const fen = generateFen(board, turn);
    window.electronAPI.sendCommand(`position fen ${fen}`);
    // go movetime <ms>
    window.electronAPI.sendCommand(`go movetime ${timeControl * 1000}`);
  };

  const applyEngineMove = (moveStr: string) => {
    // moveStr format: e.g. "b0c2" (column-row to column-row)
    // Fairy Stockfish Janggi notation uses algebraic: a-i for cols (0-8), 0-9 for rows.
    // NOTE: Standard algebraic is a0..i9. Let's parse.
    
    const colMap: Record<string, number> = { 'a':0, 'b':1, 'c':2, 'd':3, 'e':4, 'f':5, 'g':6, 'h':7, 'i':8 };
    
    const scStr = moveStr[0];
    const srStr = moveStr[1];
    const ecStr = moveStr[2];
    const erStr = moveStr[3];

    const sc = colMap[scStr];
    // Fairy Stockfish rank 0 is bottom? Or top?
    // Standard FEN: rank 9 is top (Red), rank 0 is bottom (Blue).
    // In algebraic, usually digit is rank. 
    // Let's assume: '0' -> row 9 (visually top?) or row 0? 
    // In Janggi UCI: 'a0' is typically bottom-left (Blue side).
    // Our board array: row 0 is Top (Blue start), row 9 is Bottom (Red start).
    // Wait, in `initBoard`: Row 0 is Blue Cha. So Row 0 is Top.
    // If UCI uses 'a0' as bottom, we need to flip row index: boardRow = 9 - uciRow.
    
    const sr = 9 - parseInt(srStr, 10);
    const ec = colMap[ecStr];
    const er = 9 - parseInt(erStr, 10);

    if (!isNaN(sr) && !isNaN(sc) && !isNaN(er) && !isNaN(ec)) {
       executeMove([sr, sc], [er, ec]);
    } else {
        console.error("Failed to parse engine move:", moveStr);
        isEngineThinking.current = false;
    }
  };

  // --- Game Actions ---

  const startGame = () => {
    const newBoard = initBoard(redSetup, blueSetup);
    setBoard(newBoard);
    setTurn('b'); // Blue always starts
    setHistory([]);
    setEngineScore("0.00");
    setGameStarted(true);
    setSelected(null);
    setLegalMoves([]);
    isEngineThinking.current = false;
  };

  const handleSquareClick = (r: number, c: number) => {
    if (!gameStarted) return;
    
    // Prevent human move if it's engine's turn (unless analysis mode)
    if (engineEnabled && gameMode !== 'PvP') {
        if (gameMode === 'CvC') return;
        if (gameMode === 'PvC' && turn === 'r') return;
        if (gameMode === 'CvP' && turn === 'b') return;
    }

    // 1. Select Piece
    if (!selected) {
      const piece = board[r][c];
      if (piece && piece.team === turn) {
        setSelected([r, c]);
        // Calculate legal moves for highlighting
        const moves: [number, number][] = [];
        for (let tr = 0; tr < 10; tr++) {
            for (let tc = 0; tc < 9; tc++) {
                if (isValidMove(board, [r, c], [tr, tc], turn)) {
                    moves.push([tr, tc]);
                }
            }
        }
        setLegalMoves(moves);
      }
      return;
    }

    // 2. Move or Deselect
    const [sr, sc] = selected;
    if (sr === r && sc === c) {
      setSelected(null); // Deselect
      setLegalMoves([]);
      return;
    }

    const piece = board[sr][sc];
    if (piece) {
       // If clicked own piece, switch selection
       const target = board[r][c];
       if (target && target.team === piece.team) {
         setSelected([r, c]);
         const moves: [number, number][] = [];
         for (let tr = 0; tr < 10; tr++) {
             for (let tc = 0; tc < 9; tc++) {
                 if (isValidMove(board, [r, c], [tr, tc], turn)) {
                     moves.push([tr, tc]);
                 }
             }
         }
         setLegalMoves(moves);
         return;
       }

       // Attempt Move
       if (isValidMove(board, [sr, sc], [r, c], turn)) {
         executeMove([sr, sc], [r, c]);
       } else {
         setSelected(null);
         setLegalMoves([]);
       }
    }
  };

  const executeMove = (start: [number, number], end: [number, number]) => {
    const [sr, sc] = start;
    const [er, ec] = end;
    
    const prevBoard = board.map(row => [...row]);
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[sr][sc]!;
    
    newBoard[er][ec] = piece;
    newBoard[sr][sc] = null;

    // Notation e.g., "76 -> 75" (just raw coords for now)
    const notation = `${sr},${sc} > ${er},${ec}`; 

    setBoard(newBoard);
    setSelected(null);
    setLegalMoves([]);
    setHistory(prev => [...prev, { seq: prev.length + 1, notation, turn, prevBoard }]);
    setTurn(prev => prev === 'b' ? 'r' : 'b');
    
    // Analyze new position immediately if engine enabled (even if not engine turn)
    if (window.electronAPI && engineEnabled) {
       const fen = generateFen(newBoard, turn === 'b' ? 'r' : 'b');
       window.electronAPI.sendCommand(`position fen ${fen}`);
       window.electronAPI.sendCommand(`go movetime ${timeControl * 1000}`); // Analyze
    }
  };

  const undoMove = () => {
    if (history.length === 0) return;
    const lastMove = history[history.length - 1];
    setBoard(lastMove.prevBoard);
    setHistory(prev => prev.slice(0, -1));
    setTurn(lastMove.turn); // Revert turn
    setSelected(null);
    setLegalMoves([]);
  };

  const passTurn = () => {
      setHistory(prev => [...prev, { seq: prev.length + 1, notation: "PASS", turn, prevBoard: board }]);
      setTurn(prev => prev === 'b' ? 'r' : 'b');
  };

  const resign = () => {
      alert(`${turn === 'b' ? 'Cho' : 'Han'} Resigned. Game Over.`);
      setGameStarted(false);
  };

  const saveGibo = () => {
    const content = history.map(h => `${h.seq}. ${h.turn}: ${h.notation}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Janggi_${new Date().toISOString()}.txt`;
    a.click();
  };

  // --- Render Helpers ---

  // My Score vs Your Score logic
  // If Human is Blue (Cho): My Score = Blue, Your Score = Red
  // If Human is Red (Han): My Score = Red, Your Score = Blue
  // If Engine vs Engine or Analysis: Just show Red/Blue
  const getPlayerScore = () => {
      // Default POV: Blue (Cho) is Player 1
      const myScore = materialScore.blue;
      const yourScore = materialScore.red;
      return { my: myScore, your: yourScore };
  };

  const { my, your } = getPlayerScore();

  return (
    <div className="flex flex-col h-screen bg-stone-900 text-stone-100 font-sans overflow-hidden select-none">
      
      {/* Top Bar: Scores */}
      <div className="flex justify-between items-center px-6 py-3 bg-stone-800 border-b border-stone-700 shadow-md">
        <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-amber-500 font-serif mr-4">Janggi Analyst</h1>
            
            {/* Material Scores */}
            <div className="flex gap-4 text-sm font-mono">
                <div className="flex flex-col items-center bg-stone-900 px-3 py-1 rounded border border-blue-900/50">
                    <span className="text-blue-400 font-bold">Cho (Blue)</span>
                    <span className="text-lg">{materialScore.blue}</span>
                </div>
                <div className="flex flex-col items-center bg-stone-900 px-3 py-1 rounded border border-red-900/50">
                    <span className="text-red-400 font-bold">Han (Red)</span>
                    <span className="text-lg">{materialScore.red}</span>
                </div>
            </div>

            {/* Difference */}
            <div className="text-stone-400 text-sm">
                (My: <span className="text-green-400">+{my}</span> / Your: <span className="text-red-400">-{your}</span>)
            </div>
        </div>

        {/* Engine Evaluation */}
        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-lg border border-stone-600">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-stone-400">Engine Eval:</span>
            <span className={`text-xl font-mono font-bold ${parseFloat(engineScore) > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {engineScore}
            </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Controls */}
        <div className="w-80 bg-stone-850 border-r border-stone-700 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
            
            {/* New Game / Setup */}
            <div className="bg-stone-800 p-4 rounded-xl border border-stone-700 space-y-3">
                <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Game Setup</div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-blue-400">Cho Setup</label>
                        <select className="w-full bg-stone-900 text-xs p-1 rounded border border-stone-600" value={blueSetup} onChange={e => setBlueSetup(e.target.value as SetupType)}>
                            <option value="an">An (In)</option><option value="bak">Bak (Out)</option><option value="wan">Wan (Left)</option><option value="oreun">Oreun (Right)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-red-400">Han Setup</label>
                        <select className="w-full bg-stone-900 text-xs p-1 rounded border border-stone-600" value={redSetup} onChange={e => setRedSetup(e.target.value as SetupType)}>
                           <option value="an">An (In)</option><option value="bak">Bak (Out)</option><option value="wan">Wan (Left)</option><option value="oreun">Oreun (Right)</option>
                        </select>
                    </div>
                </div>
                
                <div className="space-y-1">
                     <label className="text-xs text-stone-400">Mode</label>
                     <select className="w-full bg-stone-900 text-sm p-2 rounded border border-stone-600" value={gameMode} onChange={e => setGameMode(e.target.value as GameMode)}>
                        <option value="PvP">Human vs Human (Analysis)</option>
                        <option value="PvC">Human (Cho) vs Comp</option>
                        <option value="CvP">Comp vs Human (Han)</option>
                        <option value="CvC">Comp vs Comp</option>
                     </select>
                </div>

                <Button onClick={startGame} className="w-full justify-center">
                    <Play className="w-4 h-4 mr-2" /> Start New Game
                </Button>
            </div>

            {/* Engine Control */}
            <div className="bg-stone-800 p-4 rounded-xl border border-stone-700 space-y-3">
                <div className="flex justify-between items-center">
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">Stockfish Engine</div>
                    <div className={`w-2 h-2 rounded-full ${engineEnabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-900'}`} />
                </div>

                <div className="flex items-center justify-between bg-stone-900 p-2 rounded border border-stone-600">
                    <span className="text-xs text-stone-400">Think Time (sec)</span>
                    <input 
                        type="number" 
                        value={timeControl} 
                        onChange={e => setTimeControl(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 bg-stone-800 text-center text-sm border border-stone-600 rounded focus:border-amber-500 outline-none" 
                    />
                </div>

                <Button 
                    variant={engineEnabled ? 'danger' : 'secondary'} 
                    onClick={() => setEngineEnabled(!engineEnabled)}
                    className="w-full justify-center"
                >
                    <Cpu className="w-4 h-4 mr-2" /> 
                    {engineEnabled ? "Stop Calculation" : "Start Calculation"}
                </Button>
            </div>

            {/* Actions */}
            <div className="bg-stone-800 p-4 rounded-xl border border-stone-700 grid grid-cols-2 gap-2">
                 <Button variant="secondary" size="sm" onClick={() => setIsFlipped(!isFlipped)} title="Flip Board">
                    <Rotate3D className="w-4 h-4 mr-1" /> Flip
                 </Button>
                 <Button variant="secondary" size="sm" onClick={undoMove} disabled={history.length === 0} title="Undo Move">
                    <Undo2 className="w-4 h-4 mr-1" /> Undo
                 </Button>
                 <Button variant="secondary" size="sm" onClick={passTurn} title="Pass Turn">
                    <SkipForward className="w-4 h-4 mr-1" /> Pass
                 </Button>
                 <Button variant="secondary" size="sm" onClick={resign} disabled={!gameStarted} title="Resign">
                    <Flag className="w-4 h-4 mr-1" /> Resign
                 </Button>
            </div>

             {/* History */}
             <div className="flex-1 bg-stone-800 rounded-xl border border-stone-700 flex flex-col overflow-hidden min-h-[150px]">
                <div className="p-2 border-b border-stone-700 flex justify-between items-center bg-stone-850">
                    <span className="text-xs font-bold text-stone-400 uppercase">Gibo (History)</span>
                    <button onClick={saveGibo} className="text-stone-400 hover:text-white"><Download className="w-3 h-3" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                    {history.map((h, i) => (
                        <div key={i} className="text-xs flex gap-2 px-2 py-1 hover:bg-stone-700 rounded transition-colors text-stone-300">
                            <span className="w-6 text-stone-500">{h.seq}.</span>
                            <span className={h.turn === 'b' ? 'text-blue-400' : 'text-red-400'}>{h.turn === 'b' ? 'Cho' : 'Han'}</span>
                            <span>{h.notation}</span>
                        </div>
                    ))}
                </div>
             </div>
        </div>

        {/* Main Board Area */}
        <div className="flex-1 bg-stone-900 flex justify-center items-center p-4 overflow-auto relative">
             
             {/* Turn Indicator */}
             {gameStarted && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-stone-800/80 px-4 py-2 rounded-full border border-stone-600 backdrop-blur-sm z-20">
                     <span className="text-stone-400 text-sm mr-2">Current Turn:</span>
                     <span className={`font-bold ${turn === 'r' ? 'text-red-400' : 'text-blue-400'}`}>
                         {turn === 'r' ? 'Han (Red)' : 'Cho (Blue)'}
                     </span>
                 </div>
             )}

             <div 
                className={`relative w-[630px] h-[700px] bg-[#e6b375] shadow-2xl border-[6px] border-[#5d4037] rounded-sm select-none transition-transform duration-500 ease-in-out`}
                style={{ transform: isFlipped ? 'rotate(180deg)' : 'rotate(0deg)' }}
             >
                {/* SVG Grid */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 900 1000">
                    {[...Array(9)].map((_, i) => <line key={`v${i}`} x1={50 + i * 100} y1={50} x2={50 + i * 100} y2={950} stroke="#3e2723" strokeWidth="2" />)}
                    {[...Array(10)].map((_, i) => <line key={`h${i}`} x1={50} y1={50 + i * 100} x2={850} y2={50 + i * 100} stroke="#3e2723" strokeWidth="2" />)}
                    <line x1={350} y1={50} x2={550} y2={250} stroke="#3e2723" strokeWidth="2" />
                    <line x1={550} y1={50} x2={350} y2={250} stroke="#3e2723" strokeWidth="2" />
                    <line x1={350} y1={750} x2={550} y2={950} stroke="#3e2723" strokeWidth="2" />
                    <line x1={550} y1={750} x2={350} y2={950} stroke="#3e2723" strokeWidth="2" />
                </svg>

                {/* Pieces */}
                {gameStarted && board.map((row, r) => 
                    row.map((cell, c) => {
                        const isSelected = selected && selected[0] === r && selected[1] === c;
                        const isLegal = legalMoves.some(m => m[0] === r && m[1] === c);
                        
                        return (
                        <div 
                            key={`${r}-${c}`}
                            onClick={() => handleSquareClick(r, c)}
                            className={`absolute w-[11.11%] h-[10%] flex items-center justify-center cursor-pointer z-10`}
                            style={{ 
                                top: `${r * 10}%`, left: `${c * 11.11}%`,
                                transform: isFlipped ? 'rotate(180deg)' : 'rotate(0deg)' // Counter-rotate pieces so they are upright
                            }}
                        >
                            {/* Selection Glow */}
                            {isSelected && (
                                <div className="absolute w-[80%] h-[80%] rounded-full bg-blue-500/40 animate-pulse z-0 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                            )}

                            {/* Legal Move Marker */}
                            {isLegal && !cell && (
                                <div className="absolute w-4 h-4 bg-green-500/50 rounded-full z-20"></div>
                            )}
                            {isLegal && cell && (
                                <div className="absolute w-[90%] h-[90%] border-4 border-red-500/50 rounded-full z-20"></div>
                            )}

                            {cell && (
                                <div className={`
                                    relative z-10 w-[85%] h-[85%] rounded-full shadow-lg flex items-center justify-center 
                                    border-[3px] font-serif text-3xl font-bold bg-[#f5deb3] transition-all duration-200
                                    ${cell.team === 'r' ? 'text-[#d32f2f] border-[#d32f2f]' : 'text-[#1976d2] border-[#1976d2]'}
                                    ${['jol', 'sa'].includes(cell.type) ? 'w-[75%] h-[75%] text-2xl' : ''}
                                    ${['jang'].includes(cell.type) ? 'w-[92%] h-[92%] text-4xl' : ''}
                                `}>
                                    {PIECE_CHARS[cell.team][cell.type]}
                                </div>
                            )}
                        </div>
                    )})
                )}
             </div>
        </div>
      </div>
    </div>
  );
};

export default App;
