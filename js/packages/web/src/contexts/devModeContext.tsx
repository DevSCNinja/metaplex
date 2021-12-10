import React from "react";

export const DevModeContext = React.createContext({});

export const DevModeContextProvider = ({ children = undefined } : { children : React.ReactNode }) => {
  const [devModeEnabled, setMode] = React.useState<boolean>(false); 
  const toggleDevMode = () => {
    setMode(prev => !prev);
  }

  return (
    <DevModeContext.Provider
      value={{
        devModeEnabled,
        toggleDevMode,
      }}
    >
      {children}
    </DevModeContext.Provider>
  );
};

export const useDevModeContext = (): any => {
  const context = React.useContext(DevModeContext);
  if (!context) {
    throw new Error('Must provide DevModeContext to use');
  }
  return context;
};

