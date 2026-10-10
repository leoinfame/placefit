import { createContext, useContext } from "react";

export const HubContexto = createContext(null);
export const useHub = () => useContext(HubContexto);
