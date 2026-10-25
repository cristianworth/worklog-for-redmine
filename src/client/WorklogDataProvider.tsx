import { createContext, useContext } from "react";
import type { WorklogDataAccess } from "./data-access";

const WorklogDataContext = createContext<WorklogDataAccess | null>(null);

export const WorklogDataProvider = WorklogDataContext.Provider;

export function useWorklogData(): WorklogDataAccess {
  const data = useContext(WorklogDataContext);
  if (!data) throw new Error("O acesso aos dados não foi configurado.");
  return data;
}
