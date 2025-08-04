/**
 * NUCLEAR MODE: Completely disabled SettingsPanel
 * This is a minimal stub to prevent infinite loops
 */

import React from 'react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Settings Disabled</h2>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          Settings panel has been temporarily disabled to prevent infinite loops.
          The app is running in nuclear mode for stability.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;