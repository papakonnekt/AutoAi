
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

// Fix: Corrected the return type of the hook. The setter function's type was
// too restrictive. It's updated to Dispatch<SetStateAction<T>>, which 
// correctly allows both a direct value and an updater function (e.g., setLog(prev => ...)), 
// resolving type errors in App.tsx.
function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      const valueToStore =
        typeof storedValue === 'function'
          ? storedValue(storedValue)
          : storedValue;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;