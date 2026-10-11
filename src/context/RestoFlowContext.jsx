import { createContext, useContext } from "react";

export const RestoFlowContext = createContext(null);

export function useRestoFlow() {
  const context = useContext(RestoFlowContext);
  if (!context) {
    throw new Error("useRestoFlow doit être utilisé sous <RestoFlowContext>");
  }
  return context;
}
