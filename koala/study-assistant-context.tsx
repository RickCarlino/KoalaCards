import React from "react";

type ContextEvent = {
  id: string;
  timestamp: number;
  type: string;
  summary: string;
};

type StudyAssistantContextValue = {
  contextLog: string[];
  addContextEvent: (type: string, summary: string) => void;
};

const StudyAssistantContext = React.createContext<
  StudyAssistantContextValue | undefined
>(undefined);

const MAX_EVENTS = 30;
const MAX_SUMMARY_LENGTH = 180;

const formatSummary = (value: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_LENGTH);

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toISOString().slice(11, 16);

export function StudyAssistantContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [events, setEvents] = React.useState<ContextEvent[]>([]);

  const addContextEvent = React.useCallback(
    (type: string, summary: string) => {
      const trimmed = formatSummary(summary);
      if (!trimmed) {
        return;
      }
      setEvents((prev) => {
        const next: ContextEvent[] = [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            type: formatSummary(type),
            summary: trimmed,
          },
        ];
        return next.slice(-MAX_EVENTS);
      });
    },
    [],
  );

  const contextLog = React.useMemo(
    () =>
      events.map(
        (event) =>
          `[${formatTimestamp(event.timestamp)}] ${event.type}: ${event.summary}`,
      ),
    [events],
  );

  const value = React.useMemo(
    () => ({
      addContextEvent,
      contextLog,
    }),
    [addContextEvent, contextLog],
  );

  return (
    <StudyAssistantContext.Provider value={value}>
      {children}
    </StudyAssistantContext.Provider>
  );
}

export function useStudyAssistantContext() {
  const ctx = React.useContext(StudyAssistantContext);
  if (!ctx) {
    throw new Error(
      "useStudyAssistantContext must be used within StudyAssistantContextProvider",
    );
  }
  return ctx;
}
