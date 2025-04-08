import React, { useState, useEffect } from 'react';
import engineerReportService from '../utils/EngineerReportService';

const EngineerReportPrinter = ({ jobData, reportData }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if we have all required data to print a report
    if (jobData && jobData.job_ref && reportData && reportData.engineer_name) {
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [jobData, reportData]);

  const handlePrintReport = async () => {
    if (!isReady) {
      setError('Missing required data to print report');
      return;
    }

    setIsLoading(true);
    try {
      const result = await engineerReportService.printEngineerReport(jobData, reportData);
      if (!result.success) {
        setError(result.error || 'Failed to print report');
      } else {
        setError(null);
      }
    } catch (err) {
      setError('Error printing report: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-4 p-4 border rounded bg-gray-50">
      <h3 className="text-lg font-semibold mb-3">Engineer Report Printing</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}

      <div className="flex justify-between mt-3">
        <button
          onClick={handlePrintReport}
          disabled={isLoading || !isReady}
          className={`flex items-center px-4 py-2 rounded ${
            isLoading || !isReady
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          <span className="mr-2">🖨️</span>
          {isLoading ? 'Printing...' : 'Print Engineer Report'}
        </button>
        
        {!isReady && (
          <p className="text-gray-600 italic">
            {!jobData?.job_ref ? 'Missing job data' : 'Complete the report before printing'}
          </p>
        )}
      </div>
    </div>
  );
};

export default EngineerReportPrinter;
