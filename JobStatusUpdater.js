// components/JobStatusUpdater.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const JobStatusUpdater = ({ job, onStatusUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const { getAuthHeader, logActivity } = useAuth();
  
  // Status options 
  const statusOptions = [
    { value: "Queued", label: "Queued", color: "gray" },
    { value: "On Bench", label: "On Bench", color: "blue" },
    { value: "Waiting for Customer", label: "Waiting for Customer", color: "yellow" },
    { value: "Repaired", label: "Repaired", color: "green" },
    { value: "Unrepaired", label: "Unrepaired", color: "red" }
  ];
  
  // Init the confirmation dialog
  const handleStatusChange = (status) => {
    // Don't show confirmation for same status
    if (status === job.status) {
      return;
    }
    
    setStatusToUpdate(status);
    setShowConfirm(true);
  };
  
  // Handle actual status update
  const updateStatus = async () => {
    if (!statusToUpdate || !job) return;
    
    setLoading(true);
    setStatusMessage(null);
    
    try {
      // Clone the job object and update the status
      const updatedJob = { ...job, status: statusToUpdate };
      
      const response = await fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs/${job.job_ref}`, {
        method: "PUT",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updatedJob)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to update job status");
      }
      
      // Log activity
      logActivity("job_status_update", `Updated job #${job.job_ref} status to ${statusToUpdate}`);
      
      // Success message
      setStatusMessage({
        type: 'success',
        text: `Status updated to "${statusToUpdate}" successfully!`
      });
      
      // Notify parent component
      if (onStatusUpdated) {
        onStatusUpdated(updatedJob);
      }
    } catch (error) {
      console.error("Error updating job status:", error);
      setStatusMessage({
        type: 'error',
        text: error.message || "Failed to update status. Please try again."
      });
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };
  
  // Cancel confirmation dialog
  const cancelStatusUpdate = () => {
    setShowConfirm(false);
    setStatusToUpdate(null);
  };
  
  // Get status badge styling
  const getStatusColor = (status) => {
    const option = statusOptions.find(opt => opt.value === status);
    if (!option) return 'gray';
    return option.color;
  };
  
  if (!job) return null;
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
      <h3 className="text-lg font-semibold mb-3">Job Status</h3>
      
      {/* Current status display */}
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Current Status:</div>
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${getStatusColor(job.status)}-100 text-${getStatusColor(job.status)}-800`}>
          {job.status}
        </div>
      </div>
      
      {/* Status update buttons */}
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            disabled={option.value === job.status || loading}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              option.value === job.status 
                ? `bg-${option.color}-100 text-${option.color}-800 border-2 border-${option.color}-500 cursor-default`
                : `bg-${option.color}-100 text-${option.color}-800 hover:bg-${option.color}-200`
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      
      {/* Status update message */}
      {statusMessage && (
        <div className={`mt-3 p-2 rounded text-sm ${
          statusMessage.type === 'error' 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {statusMessage.text}
        </div>
      )}
      
      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Status Change</h3>
            <p className="mb-6">
              Are you sure you want to change the job status from <span className="font-medium">{job.status}</span> to <span className="font-medium">{statusToUpdate}</span>?
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelStatusUpdate}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={updateStatus}
                className={`px-4 py-2 text-white rounded hover:bg-${getStatusColor(statusToUpdate)}-600 bg-${getStatusColor(statusToUpdate)}-500`}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </span>
                ) : "Confirm Change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobStatusUpdater;