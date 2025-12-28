export type Team = 'r' | 'b'; // r = Red (Han), b = Blue (Cho)
export type PieceType = 'cha' | 'ma' | 'sang' | 'po' | 'sa' | 'jang' | 'jol';

export interface Piece {
  type: PieceType;
  team: Team;
}

export type Board = (Piece | null)[][];

export type SetupType = 'wan' | 'oreun' | 'an' | 'bak';

export interface MoveRecord {
  seq: number;
  notation: string; // e.g., "76 -> 75"
  turn: Team;
  prevBoard: Board; // For Undo
}

export type GameMode = 'PvP' | 'CvC' | 'PvC' | 'CvP'; 
// PvP: Human vs Human (Analysis)
// CvC: Engine vs Engine
// PvC: Human(Cho) vs Engine(Han) - User is Blue
// CvP: Engine(Cho) vs Human(Han) - User is Red

export interface GameState {
  board: Board;
  turn: Team;
  history: MoveRecord[];
  gameStarted: boolean;
  redSetup: SetupType;
  blueSetup: SetupType;
}

// 요청하신 기물 점수
export const PIECE_SCORES: Record<PieceType, number> = {
  cha: 13,
  po: 7,
  ma: 5,
  sang: 3,
  sa: 3,
  jol: 2,
  jang: 0
};

export interface GitHubNode {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  _links?: {
    self: string;
    git: string;
    html: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}
