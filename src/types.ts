export interface Diagnostic {
  path: string;
  message: string;
}

export interface ScannedFile {
  absolutePath: string;
  displayPath: string;
}

export interface ScanResult {
  files: ScannedFile[];
  diagnostics: Diagnostic[];
}

export interface Tokenizer {
  cut(text: string): string[];
}

export interface WordFrequency {
  word: string;
  count: number;
}

export interface FileStatistics {
  file: string;
  chineseCharacters: number;
  topWords: WordFrequency[];
}
