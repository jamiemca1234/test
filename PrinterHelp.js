// components/PrinterHelp.js
import React, { useState } from 'react';

const PrinterHelp = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md mt-4 overflow-hidden">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left flex items-center justify-between font-medium text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Printer Troubleshooting
        </div>
        <svg 
          className={`w-5 h-5 transform transition-transform ${expanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {expanded && (
        <div className="p-4 border-t border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">Dymo Label Printer Troubleshooting</h4>
          
          <div className="space-y-3 text-sm text-blue-700">
            <p><strong>Requirements:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>DYMO Label software must be installed on your computer</li>
              <li>Your Dymo LabelWriter 450 printer must be connected and powered on</li>
              <li>You must have the correct label stock loaded (30253 Address labels)</li>
            </ul>
            
            <p><strong>If the "Print Label" button is disabled:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Make sure you have saved the job first to generate a Job ID</li>
              <li>Check that your Dymo printer is connected and turned on</li>
            </ul>
            
            <p><strong>If you get a "No DYMO printer found" error:</strong></p>
            <ol className="list-decimal list-inside ml-2 space-y-1">
              <li>Make sure the Dymo printer is connected via USB and powered on</li>
              <li>Close and reopen the DYMO Label software</li>
              <li>Try printing a test label from the DYMO Label software</li>
              <li>Restart your computer if the problem persists</li>
              <li>Click the "Refresh" button to re-detect printers</li>
            </ol>
            
            <p><strong>If you get a "Dymo SDK not loaded" error:</strong></p>
            <ol className="list-decimal list-inside ml-2 space-y-1">
              <li>Make sure DYMO Label software version 8.7 or later is installed</li>
              <li>Download it from <a href="https://www.dymo.com/support?cfid=software" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">DYMO's official website</a></li>
              <li>Restart your browser after installation</li>
            </ol>
            
            <p className="mt-2">
              <strong>Note:</strong> If you're using the printer connected to another computer on the network, make sure printer sharing is enabled and the DYMO Label software is running on that computer.
            </p>

            <p className="pt-1 border-t border-blue-200">
              <strong>Windows path for DYMO software: </strong>
              <span className="bg-blue-100 p-1 rounded text-xs font-mono">C:\Program Files\DYMO\DYMO Label Software</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterHelp;