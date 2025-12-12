import type { CreateMode } from "@/koala/create/modes";
import type { DeckOption } from "@/koala/create/create-utils";
import type { ParsedRow, State } from "@/koala/types/create-types";

export type EditableField = "term" | "definition";

export type CreateController = {
  loading: boolean;
  mode: CreateMode;
  setMode: (mode: CreateMode) => void;
  separator: string;
  setSeparator: (sep: string) => void;
  state: State;
  deckOptions: DeckOption[];
  lines: string[];
  parsedRows: ParsedRow[];
  canSave: boolean;
  setRawInput: (rawInput: string) => void;
  setDeckSelection: (deckSelection: State["deckSelection"]) => void;
  setDeckName: (deckName: string) => void;
  onExistingDeckChange: (val: string | null) => void;
  onEditCard: (index: number, field: EditableField, value: string) => void;
  onRemoveCard: (index: number) => void;
  onSubmitVibe: () => Promise<void>;
  onProcessWordlist: () => Promise<void>;
  onParseCsv: () => void;
  onSave: () => Promise<void>;
};
