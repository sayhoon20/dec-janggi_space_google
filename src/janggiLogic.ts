import { Board, Piece, PieceType, Team, SetupType, PIECE_SCORES } from './types';

const RED = 'r';
const BLUE = 'b';

const p = (team: Team, type: PieceType): Piece => ({ team, type });

export const initBoard = (redSetup: SetupType, blueSetup: SetupType): Board => {
  const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));

  // Pawns
  for (let c = 0; c < 9; c += 2) {
    board[3][c] = p(BLUE, 'jol');
    board[6][c] = p(RED, 'jol');
  }

  // Cannons
  board[2][1] = p(BLUE, 'po'); board[2][7] = p(BLUE, 'po');
  board[7][1] = p(RED, 'po'); board[7][7] = p(RED, 'po');

  // Kings & Guards
  board[1][4] = p(BLUE, 'jang');
  board[0][3] = p(BLUE, 'sa'); board[0][5] = p(BLUE, 'sa');
  
  board[8][4] = p(RED, 'jang');
  board[9][3] = p(RED, 'sa'); board[9][5] = p(RED, 'sa');

  const setupHomeRank = (row: number, team: Team, setup: SetupType) => {
    board[row][0] = p(team, 'cha');
    board[row][8] = p(team, 'cha');

    let inner: PieceType[] = [];
    switch (setup) {
      case 'wan':   inner = ['ma', 'sang', 'ma', 'sang']; break;
      case 'oreun': inner = ['sang', 'ma', 'sang', 'ma']; break;
      case 'an':    inner = ['ma', 'sang', 'sang', 'ma']; break;
      case 'bak':   inner = ['sang', 'ma', 'ma', 'sang']; break;
    }
    board[row][1] = p(team, inner[0]);
    board[row][2] = p(team, inner[1]);
    board[row][6] = p(team, inner[2]);
    board[row][7] = p(team, inner[3]);
  };

  setupHomeRank(0, BLUE, blueSetup);
  setupHomeRank(9, RED, redSetup);

  return board;
};

// 기물 점수 계산 (내 점수 +, 상대 점수 - 개념을 위해 각각 반환)
export const calculateMaterialScore = (board: Board): { red: number, blue: number } => {
  let redScore = 0;
  let blueScore = 0;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece) {
        if (piece.team === RED) redScore += PIECE_SCORES[piece.type];
        else blueScore += PIECE_SCORES[piece.type];
      }
    }
  }
  return { red: redScore, blue: blueScore };
};

// Fairy Stockfish를 위한 FEN 생성
export const generateFen = (board: Board, turn: Team): string => {
  const rows: string[] = [];
  
  const fenMap: Record<string, string> = {
    'r-cha': 'R', 'r-ma': 'N', 'r-sang': 'E', 'r-po': 'C', 'r-sa': 'A', 'r-jang': 'K', 'r-jol': 'P',
    'b-cha': 'r', 'b-ma': 'n', 'b-sang': 'e', 'b-po': 'c', 'b-sa': 'a', 'b-jang': 'k', 'b-jol': 'p'
  };

  for (let r = 0; r < 10; r++) {
    let rowStr = "";
    let emptyCount = 0;
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece) {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        rowStr += fenMap[`${piece.team}-${piece.type}`];
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) rowStr += emptyCount;
    rows.push(rowStr);
  }

  // w = Red(Han) goes next?? No, standard FEN: 'w' is white(first?), 'b' is black. 
  // In Janggi: Cho(Blue) starts first.
  // Fairy SF Janggi: 'b' (Blue/Cho) usually maps to 'black' side but moves first? 
  // Standard UCI for Janggi often uses 'w' (Red) and 'b' (Blue).
  // Let's assume standard protocol: turn is 'b' (Cho) or 'w' (Han).
  const turnChar = turn === 'b' ? 'b' : 'w';
  
  return `${rows.join('/')} ${turnChar} - - 0 1`;
};

// --- Movement Logic ---

const countObstacles = (board: Board, [sy, sx]: [number, number], [ey, ex]: [number, number]): number => {
  let count = 0;
  const dy = Math.sign(ey - sy);
  const dx = Math.sign(ex - sx);
  let r = sy + dy;
  let c = sx + dx;
  while (r !== ey || c !== ex) {
    if (board[r][c]) count++;
    r += dy;
    c += dx;
  }
  return count;
};

const hasObstacle = (board: Board, start: [number, number], end: [number, number]): boolean => countObstacles(board, start, end) > 0;

export const isValidMove = (board: Board, start: [number, number], end: [number, number], turn: Team): boolean => {
  const [sy, sx] = start;
  const [ey, ex] = end;
  
  if (sy === ey && sx === ex) return false;
  const piece = board[sy][sx];
  if (!piece || piece.team !== turn) return false;
  
  const target = board[ey][ex];
  if (target && target.team === piece.team) return false;

  const dy = ey - sy;
  const dx = ex - sx;
  const absDy = Math.abs(dy);
  const absDx = Math.abs(dx);

  const inPalace = (r: number, c: number, team: Team) => {
    if (c < 3 || c > 5) return false;
    if (team === BLUE) return r >= 0 && r <= 2;
    if (team === RED) return r >= 7 && r <= 9;
    return false;
  };

  switch (piece.type) {
    case 'cha': 
      if ((sx === ex || sy === ey) && !hasObstacle(board, start, end)) return true;
      if (inPalace(sy, sx, piece.team) && inPalace(ey, ex, piece.team) && absDx === absDy && !hasObstacle(board, start, end)) return true;
      return false;
      
    case 'jol': 
      if (absDx + absDy > 1) {
         if (inPalace(sy, sx, piece.team) && inPalace(ey, ex, piece.team) && absDx === 1 && absDy === 1) {
             if (piece.team === BLUE && dy > 0) return true;
             if (piece.team === RED && dy < 0) return true;
         }
         return false;
      }
      if (piece.team === BLUE && dy < 0) return false; 
      if (piece.team === RED && dy > 0) return false;
      return true;

    case 'ma': 
      if (absDx === 1 && absDy === 2) return !board[sy + (dy / 2)][sx];
      if (absDx === 2 && absDy === 1) return !board[sy][sx + (dx / 2)];
      return false;

    case 'sang': 
      if (absDx === 2 && absDy === 3) return !board[sy + (dy / 3)][sx] && !board[sy + (dy / 3) * 2][sx + (dx / 2)];
      if (absDx === 3 && absDy === 2) return !board[sy][sx + (dx / 3)] && !board[sy + (dy / 2)][sx + (dx / 3) * 2];
      return false;

    case 'sa': 
    case 'jang': 
      if (!inPalace(ey, ex, piece.team)) return false;
      if (absDx + absDy === 1) return true; 
      if (absDx === 1 && absDy === 1) {
        const isCenterStart = (sy === 1 && sx === 4) || (sy === 8 && sx === 4);
        const isCenterEnd = (ey === 1 && ex === 4) || (ey === 8 && ex === 4);
        return isCenterStart || isCenterEnd;
      }
      return false;
      
    case 'po': 
      if (target && target.type === 'po') return false; 
      if (sx === ex || sy === ey) return countObstacles(board, start, end) === 1;
      if (inPalace(sy, sx, piece.team) && inPalace(ey, ex, piece.team) && absDx === absDy) {
          return countObstacles(board, start, end) === 1;
      }
      return false;
  }
  return false;
};
