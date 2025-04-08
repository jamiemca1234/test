// components/DymoPrinter.js
import React, { useState, useEffect } from 'react';

const DymoPrinter = ({ 
  jobRef, 
  customerName, 
  contactNumber, 
  checkedInDate, 
  depositPaid,
  onSuccess,
  onError
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [dymoInitialized, setDymoInitialized] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Format date or use current date
  const formatDate = (dateString) => {
    const date = dateString ? new Date(dateString) : new Date();
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  // Initialize DYMO SDK
  useEffect(() => {
    loadDymoScript()
      .then(() => initDymo())
      .catch(error => {
        console.error("Failed to load Dymo SDK:", error);
        setStatus({
          type: 'error',
          message: 'Could not load the Dymo printer software. Please ensure Dymo Label software is installed.'
        });
      });
  }, []);

  // Load the Dymo SDK script
  const loadDymoScript = () => {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      if (window.dymo && window.dymo.label && window.dymo.label.framework) {
        console.log("Dymo SDK already loaded");
        return resolve();
      }

      // Check if script is already in progress of loading
      if (document.querySelector('script[src*="DYMO.Label.Framework"]')) {
        console.log("Dymo script is already loading");
        const checkDymoLoaded = setInterval(() => {
          if (window.dymo && window.dymo.label && window.dymo.label.framework) {
            clearInterval(checkDymoLoaded);
            resolve();
          }
        }, 200);
        return;
      }
      
      const script = document.createElement('script');
      script.src = "https://labelwriter.com/software/dls/sdk/js/DYMO.Label.Framework.latest.js";
      script.async = true;
      
      script.onload = () => {
        console.log("Dymo script loaded successfully!");
        resolve();
      };
      
      script.onerror = () => {
        console.error("Failed to load Dymo script");
        reject(new Error("Failed to load Dymo SDK script."));
      };
      
      document.body.appendChild(script);
    });
  };

  // Initialize DYMO framework and get available printers
  const initDymo = async () => {
    try {
      // Initialize the framework
      if (window.dymo && window.dymo.label && window.dymo.label.framework) {
        console.log("Initializing Dymo framework...");
        await window.dymo.label.framework.init();
        console.log("Dymo framework initialized successfully");
        
        // Check for available printers
        const printers = await window.dymo.label.framework.getPrinters();
        console.log("Available printers:", printers);
        
        // Filter to only LabelWriter printers
        const labelPrinters = printers.filter(p => p.printerType === "LabelWriterPrinter");
        
        if (labelPrinters.length === 0) {
          setStatus({
            type: 'warning',
            message: 'No DYMO LabelWriter printers found. Please connect your DYMO printer.'
          });
        } else {
          setAvailablePrinters(labelPrinters);
          setSelectedPrinter(labelPrinters[0].name);
          setStatus({
            type: 'success',
            message: `Found ${labelPrinters.length} DYMO printer(s)`
          });
        }
        
        setDymoInitialized(true);
      } else {
        throw new Error("Dymo framework not available");
      }
    } catch (error) {
      console.error("Failed to initialize Dymo:", error);
      setStatus({
        type: 'error',
        message: 'Could not initialize Dymo printer. Please ensure Dymo software is running.'
      });
      setDymoInitialized(false);
    }
  };

  // Create and print the label
  const printLabel = async () => {
    if (!dymoInitialized) {
      // Try to initialize again
      try {
        await loadDymoScript();
        await initDymo();
      } catch (error) {
        setStatus({
          type: 'error',
          message: 'Failed to initialize Dymo software. Please check if DYMO software is installed.'
        });
        if (onError) onError(error);
        return;
      }
    }

    setLoading(true);
    setStatus(null);

    try {
      if (!window.dymo || !window.dymo.label || !window.dymo.label.framework) {
        throw new Error("Dymo SDK not loaded or initialized");
      }

      if (!jobRef) {
        throw new Error("Job reference number is required");
      }

      // Format date and deposit
      const formattedDate = formatDate(checkedInDate);
      const depositAmount = depositPaid ? parseInt(depositPaid) : "0";
      
      // Create a label XML template for 30253 Address labels
      const labelXml = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>30253 Address</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="1581" Height="5040" Rx="270" Ry="270" />
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>JobRef</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>None</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>Job #${jobRef}</String>
          <Attributes>
            <Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="331" Y="150" Width="4367" Height="484" />
  </ObjectInfo>
  <ObjectInfo>
    <LineObject>
      <Name>Line</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <LineWidth>15</LineWidth>
      <LineAlignment>Center</LineAlignment>
      <FillMode>None</FillMode>
    </LineObject>
    <Bounds X="331" Y="634" Width="4361" Height="15" />
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>CustomerName</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>None</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${customerName || 'Customer Name'}</String>
          <Attributes>
            <Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="331" Y="664" Width="4361" Height="420" />
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>ContactNumber</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>None</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${contactNumber || 'Contact Number'}</String>
          <Attributes>
            <Font Family="Arial" Size="9" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="331" Y="1067" Width="4361" Height="390" />
  </ObjectInfo>
  <ObjectInfo>
    <LineObject>
      <Name>Line2</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <LineWidth>15</LineWidth>
      <LineAlignment>Center</LineAlignment>
      <FillMode>None</FillMode>
    </LineObject>
    <Bounds X="331" Y="1433" Width="4361" Height="15" />
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>DateInfo</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>None</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>Date: ${formattedDate}</String>
          <Attributes>
            <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="331" Y="1463" Width="2173" Height="270" />
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>DepositInfo</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Right</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>None</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>Deposit: £${depositAmount}</String>
          <Attributes>
            <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="2504" Y="1463" Width="2188" Height="270" />
  </ObjectInfo>
</DieCutLabel>`;

      // Open the label
      const label = window.dymo.label.framework.openLabelXml(labelXml);
      
      // If no printer is selected but we have available printers, use the first one
      const printerToUse = selectedPrinter || (availablePrinters.length > 0 ? availablePrinters[0].name : null);
      
      if (!printerToUse) {
        throw new Error("No DYMO printer available");
      }
      
      // Print the label
      console.log("Printing label to", printerToUse);
      label.print(printerToUse);
      
      setStatus({
        type: 'success',
        message: `Label printed successfully to ${printerToUse}`
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error printing job label:", error);
      setStatus({
        type: 'error',
        message: `Error printing label: ${error.message}`
      });
      
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Try to refresh Dymo connection
  const handleRefreshDymo = async () => {
    setLoading(true);
    setStatus({
      type: 'info',
      message: 'Refreshing Dymo connection...'
    });
    
    try {
      await loadDymoScript();
      await initDymo();
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'Failed to refresh Dymo connection'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 mb-4">
      <h3 className="text-lg font-semibold mb-3">Print Job Label</h3>
      
      {/* Status messages */}
      {status && (
        <div className={`mb-4 p-3 rounded text-sm ${
          status.type === 'error' 
            ? 'bg-red-100 text-red-700 border border-red-200' 
            : status.type === 'warning'
            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
            : status.type === 'info'
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'bg-green-100 text-green-700 border border-green-200'
        }`}>
          {status.message}
        </div>
      )}
      
      {/* Main button */}
      <div className="flex items-center space-x-2">
        <button
          onClick={printLabel}
          disabled={loading || !jobRef}
          className={`px-4 py-2 rounded flex items-center ${
            loading || !jobRef
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Printing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Label
            </>
          )}
        </button>
        
        <button
          onClick={handleRefreshDymo}
          disabled={loading}
          className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-gray-500 hover:text-gray-700 text-sm flex items-center ml-auto"
        >
          Advanced Options
          <svg className={`w-4 h-4 ml-1 transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {/* Advanced options */}
      {showAdvanced && (
        <div className="mt-4 p-3 bg-gray-100 rounded border border-gray-200">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Printer
            </label>
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              disabled={availablePrinters.length === 0}
            >
              {availablePrinters.length === 0 ? (
                <option value="">No printers available</option>
              ) : (
                availablePrinters.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.name}
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div className="text-xs text-gray-500">
            <p className="mb-1">
              <strong>Status:</strong> {dymoInitialized ? 'Dymo initialized ✓' : 'Dymo not initialized ✗'}
            </p>
            <p>
              <strong>Printers Found:</strong> {availablePrinters.length}
            </p>
            {!dymoInitialized && (
              <p className="mt-2 text-yellow-600">
                Make sure DYMO Label software is installed and running.
                <a 
                  href="https://www.dymo.com/support?cfid=software" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline ml-1"
                >
                  Download DYMO Software
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DymoPrinter;