import React, { useState, useEffect } from 'react';
import { AIMode } from '../types';
import { validateApiKey } from '../services/geminiService';
import { quotaManager } from '../services/quotaManager';
import { QUOTA_LIMITS } from '../constants';
import RateLimitDisplay from './RateLimitDisplay';


interface SettingsTabProps {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  aiMode: AIMode;
  setAiMode: (mode: AIMode) => void;
  isAutonomous: boolean;
  setIsAutonomous: (isAutonomous: boolean) => void;
}

type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

const SettingsTab: React.FC<SettingsTabProps> = ({ apiKey, setApiKey, aiMode, setAiMode, isAutonomous, setIsAutonomous }) => {
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [usage, setUsage] = useState({ rpm: 0, rpd: 0 });

  const keyToTrack = aiMode === AIMode.PAID ? apiKey : null;
  const limits = QUOTA_LIMITS[aiMode];

  useEffect(() => {
     const interval = setInterval(() => {
        setUsage(quotaManager.getUsageStats(keyToTrack));
     }, 2000); // Poll every 2 seconds
     return () => clearInterval(interval);
  }, [keyToTrack]);


  // Reset validation status if the user types a new key
  useEffect(() => {
    setValidationStatus('idle');
    setValidationMessage('');
  }, [keyInput]);

  const handleValidateKey = async () => {
    const trimmedKey = keyInput.trim();
    if (!trimmedKey) {
        setValidationStatus('invalid');
        setValidationMessage('API Key cannot be empty.');
        return;
    }
    setValidationStatus('validating');
    setValidationMessage('');
    const result = await validateApiKey(trimmedKey);
    if (result.valid) {
        setValidationStatus('valid');
        setValidationMessage('API Key is valid and active!');
    } else {
        setValidationStatus('invalid');
        setValidationMessage(result.error || 'Validation failed.');
    }
  };

  const handleSaveKey = () => {
    const trimmedKey = keyInput.trim();
    
    // Basic client-side format validation
    const apiKeyRegex = /^[A-Za-z0-9_-]{30,}$/;
    if (trimmedKey && !apiKeyRegex.test(trimmedKey)) {
        setValidationStatus('invalid');
        setValidationMessage('Invalid API key format. Key should be at least 30 characters and contain only alphanumeric characters, underscores, or hyphens.');
        return;
    }

    if (trimmedKey) {
      setApiKey(trimmedKey);
      alert('API Key saved.');
    } else {
      setApiKey(null);
      setAiMode(AIMode.FREE);
      alert('API Key removed. Switched to Free Mode.');
    }
    setValidationStatus('idle'); 
    setValidationMessage('');
  };
  
  const handleModeToggle = () => {
    if (!apiKey) return;
    setAiMode(aiMode === AIMode.PAID ? AIMode.FREE : AIMode.PAID);
  };
  
  const handleResetState = () => {
      if(window.confirm("Are you sure you want to reset all agent state? This will delete its memory, code versions, and virtual file system. This action cannot be undone.")) {
          Object.keys(window.localStorage)
              .filter(key => key.startsWith('ai-'))
              .forEach(key => window.localStorage.removeItem(key));
          window.location.reload();
      }
  };

  const getInputClasses = () => {
    const base = "flex-grow bg-gray-900 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors";
    switch (validationStatus) {
        case 'valid': return `${base} border-green-500`;
        case 'invalid': return `${base} border-red-500`;
        default: return `${base} border-gray-700`;
    }
  };


  return (
    <div className="p-6 h-full flex flex-col gap-8 text-gray-300 overflow-y-auto">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">API Key Management</h3>
        <p className="text-sm text-gray-400">
          Provide your own Gemini API key to enable "Paid Mode" with higher usage limits. Your key is stored only in your browser's local storage.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Enter your Gemini API Key"
            className={getInputClasses()}
          />
           <button
            onClick={handleValidateKey}
            disabled={validationStatus === 'validating' || !keyInput.trim()}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait shrink-0"
          >
            {validationStatus === 'validating' ? 'Validating...' : 'Validate'}
          </button>
          <button
            onClick={handleSaveKey}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors shrink-0"
          >
            Save Key
          </button>
        </div>
         {validationMessage && (
            <p className={`text-sm pt-1 ${validationStatus === 'valid' ? 'text-green-400' : 'text-red-400'}`}>
                {validationMessage}
            </p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Operational Controls</h3>
        <div className="bg-gray-850 p-4 rounded-lg flex items-center justify-between">
            <div>
                <span className={`font-bold text-xl ${aiMode === AIMode.PAID ? 'text-green-400' : 'text-yellow-400'}`}>
                    {aiMode} Mode
                </span>
                <p className="text-sm text-gray-400 mt-1">
                    {aiMode === AIMode.FREE 
                        ? "Uses a built-in, shared API with strict limits."
                        : "Uses your API key. Limits are set high for maximum reasoning."
                    }
                </p>
            </div>
          <button
            onClick={handleModeToggle}
            disabled={!apiKey}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
              aiMode === AIMode.PAID ? 'bg-indigo-600' : 'bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500`}
          >
            <span
              className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                aiMode === AIMode.PAID ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        <div className="bg-gray-850 p-4 rounded-lg space-y-3">
            <RateLimitDisplay 
                title={`${aiMode} Mode Quota Usage`}
                stats={usage}
                limits={limits}
            />
        </div>

        {!apiKey && <p className="text-sm text-yellow-500">You must save an API key to enable Paid Mode.</p>}

         <div className="bg-gray-850 p-4 rounded-lg flex items-center justify-between">
            <div>
                <span className={`font-bold text-xl ${isAutonomous ? 'text-green-400' : 'text-yellow-400'}`}>
                    Autonomous Mode
                </span>
                <p className="text-sm text-gray-400 mt-1">
                   {isAutonomous ? "ON: Agent will start automatically on page load." : "OFF: Agent will wait for user to press Resume."}
                </p>
            </div>
          <button
            onClick={() => setIsAutonomous(!isAutonomous)}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
              isAutonomous ? 'bg-indigo-600' : 'bg-gray-600'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500`}
          >
            <span
              className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                isAutonomous ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
         <div className="bg-red-900/20 p-4 rounded-lg border border-red-700/50 flex items-center justify-between">
            <div>
                <p className="font-semibold text-white">Hard Reset Agent</p>
                <p className="text-sm text-red-300 mt-1">
                   This will permanently delete all of the agent's memories, code history, and files.
                </p>
            </div>
            <button
                onClick={handleResetState}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
             >
                Reset State
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;