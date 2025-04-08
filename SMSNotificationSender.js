import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const SMSNotificationSender = ({ job, onSMSSent }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const { getAuthHeader, logActivity, apiUrl } = useAuth();

  // Generate a default message based on job data
  const generateDefaultMessage = () => {
    const customerName = job?.customer_name || 'Customer';
    const deviceType = job?.device_type || 'device';
    const jobRef = job?.job_ref || '';

    return `Hi ${customerName}, your ${deviceType} is ready for collection from Newry Computer Centre. Job #${jobRef}`;
  };

  // Set default message when component mounts or job changes
  React.useEffect(() => {
    if (job) {
      setMessage(generateDefaultMessage());
    }
  }, [job]);

  // Handle sending SMS
  const handleSendSMS = async () => {
    if (!job?.contact_number || !job?.job_ref) {
      setStatusMessage({
        type: 'error',
        text: "❌ Cannot send SMS: Missing contact number or job reference"
      });
      return;
    }
    
    if (!message.trim()) {
      setStatusMessage({
        type: 'error',
        text: "❌ Cannot send SMS: Message cannot be empty"
      });
      return;
    }

    // Use the apiUrl from context if available, otherwise use the direct URL
    const baseUrl = apiUrl || 'https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000';
    const apiEndpoint = `${baseUrl}/api/send-sms`;
    
    // Set loading state
    setLoading(true);
    setStatusMessage(null);

    console.log("Sending SMS to:", job.contact_number);
    console.log("Message:", message);
    console.log("API Endpoint:", apiEndpoint);

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: job.contact_number,
          message: message,
          job_ref: job.job_ref
        })
      });
      
      // Check if the response is ok
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: "✅ SMS sent successfully!"
        });
        
        // Log activity
        logActivity("send_sms", `Sent SMS to ${job.contact_number} for job #${job.job_ref}`);
        
        // Notify parent component
        if (onSMSSent) {
          onSMSSent(data.notification);
        }
      } else {
        console.error("SMS sending failed:", data);
        setStatusMessage({
          type: 'error',
          text: `❌ Error sending SMS: ${data.error || 'Unknown error'}${data.details ? ` - ${data.details}` : ''}`
        });
      }
    } catch (error) {
      console.error("SMS Error:", error);
      setStatusMessage({
        type: 'error',
        text: `❌ Error sending SMS: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset the message to default
  const handleResetMessage = () => {
    setMessage(generateDefaultMessage());
  };

  if (!job) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
      <h3 className="text-lg font-semibold mb-3">Send SMS Notification</h3>
      
      {/* Recipient information */}
      <div className="mb-3">
        <div className="text-sm text-gray-600 mb-1">Recipient:</div>
        <div className="font-medium">
          {job.customer_name} ({job.contact_number || 'No phone number'})
        </div>
      </div>
      
      {/* Message textarea */}
      <div className="mb-3">
        <label className="block text-sm text-gray-600 mb-1">Message:</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full p-2 border rounded resize-y"
          rows="4"
          placeholder="Enter message here..."
          disabled={loading}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{message.length} characters</span>
          <button 
            onClick={handleResetMessage}
            className="text-blue-600 hover:underline"
            disabled={loading}
          >
            Reset to default
          </button>
        </div>
      </div>
      
      {/* Send button */}
      <div className="flex">
        <button
          onClick={handleSendSMS}
          disabled={loading || !job.contact_number}
          className={`px-4 py-2 rounded text-white flex items-center ${
            loading || !job.contact_number
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send SMS
            </>
          )}
        </button>
      </div>
      
      {/* Status message */}
      {statusMessage && (
        <div className={`mt-3 p-2 rounded text-sm ${
          statusMessage.type === 'error' 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {statusMessage.text}
        </div>
      )}
      
      {/* Warning if no phone number */}
      {!job.contact_number && (
        <div className="mt-3 p-2 bg-yellow-100 text-yellow-700 rounded text-sm">
          ⚠️ Cannot send SMS: No contact number provided for this job.
        </div>
      )}
    </div>
  );
};

export default SMSNotificationSender;