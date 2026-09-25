import React, { createContext, useContext } from "react";

const RestoFlowContext = createContext(null);

export function RestoFlowProvider({ value, children }) {
  return (
    <RestoFlowContext.Provider value={value}>
      {children}
    </RestoFlowContext.Provider>
  );
}

export function useRestoFlow() {
  const context = useContext(RestoFlowContext);
  if (!context) {
    throw new Error("useRestoFlow must be used within a RestoFlowProvider");
  }
  return context;
}

export default RestoFlowContext;
