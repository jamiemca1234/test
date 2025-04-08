import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useAuth } from "../context/AuthContext";

const SMSNotificationHistory = forwardRef(({ jobRef }, ref) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getAuthHeader, apiUrl } = useAuth();

  const fetchSMSHistory = async () => {
    if (!jobRef) return;
    
    setLoading(true);
    try {
      // Use apiUrl from context if available, otherwise use the direct URL
      const baseUrl = apiUrl || 'https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000';
      const apiEndpoint = `${baseUrl}/api/sms-notifications/${jobRef}`;
      
      console.log("Fetching SMS history from:", apiEndpoint);
      console.log("Auth headers:", getAuthHeader()); // Debug line to check the token
      
      const response = await fetch(apiEndpoint, {
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching SMS history: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("SMS history data:", data); // Debug line to see the response
      setNotifications(data);
    } catch (err) {
      console.error("Error fetching SMS history:", err);
    } finally {
      setLoading(false);
    }
  };

  // Expose the refresh function to parent components
  useImperativeHandle(ref, () => ({
    refresh: fetchSMSHistory
  }));

  useEffect(() => {
    fetchSMSHistory();
  }, [jobRef]);

  if (loading && notifications.length === 0) {
    return (
      <div className="py-3">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return <div className="text-sm text-gray-500 italic py-3">No SMS notifications have been sent yet.</div>;
  }

  return (
    <div className="mt-2">
      <div className="max-h-56 overflow-y-auto pr-2">
        {notifications.map(sms => (
          <div key={sms.id} className="mb-3 bg-gray-50 p-3 rounded-md shadow-sm">
            <div className="flex justify-between items-start">
              <span className="font-medium text-sm">
                {new Date(sms.sent_at).toLocaleString('en-GB', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                sms.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {sms.status}
              </span>
            </div>
            <div className="text-gray-600 text-sm mt-1">
              <div>
                <span className="font-medium">Sent by:</span> {sms.full_name || sms.sent_by}
              </div>
              <div>
                <span className="font-medium">To:</span> {sms.recipient}
              </div>
            </div>
            <div className="mt-2 border-l-2 border-blue-300 pl-2 text-gray-700 text-sm">
              {sms.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default SMSNotificationHistory;