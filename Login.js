import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ checked: false, success: false });
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, apiUrl } = useAuth();
  
  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);
  
  // Check API connectivity on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const healthEndpoint = apiUrl ? `${apiUrl}/api/health` : 'https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/health';
        
        console.log(`Testing connection to: ${healthEndpoint}`);
        // Simple health check
        const response = await fetch(healthEndpoint, {
          method: 'GET',
          // Add cache: 'no-store' to prevent caching
          cache: 'no-store'
        });
        
        // Even if we get an error response, it means we can connect to the API
        setConnectionStatus({ checked: true, success: true });
        console.log("API health check successful");
        
      } catch (err) {
        console.error("API connection error:", err);
        setConnectionStatus({ checked: true, success: false });
        
        // Set an informative error message
        setError(`Can't connect to the server. Please make sure the server is running and your network is connected.`);
      }
    };
    
    checkConnection();
  }, [apiUrl]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    
    try {
      setIsLoading(true);
      setError("");
      
      await login(username, password);
      
      // Navigate to dashboard or previous page
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed. Please check your credentials and network connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // Test the connection manually
  const testConnection = async () => {
    setError("");
    setConnectionStatus({ checked: false, success: false });
    
    try {
      // Construct the URL, trying both https and https
      const urls = [
        `https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/health`,
        `https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/health`
      ];
      
      let success = false;
      
      for (const url of urls) {
        try {
          console.log(`Testing connection to: ${url}`);
          const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store'
          });
          
          if (response.ok) {
            console.log(`Connection successful to ${url}`);
            success = true;
            
            // If using https but https worked, display a hint
            if (apiUrl && apiUrl.startsWith('https://') && url.startsWith('https://')) {
              setError("https connection failed but https works. Try using https instead by updating API_BASE in your AuthContext.");
            } else {
              setError("");
            }
            
            break;
          }
        } catch (innerErr) {
          console.error(`Connection to ${url} failed:`, innerErr);
        }
      }
      
      setConnectionStatus({ checked: true, success });
      
      if (!success) {
        setError("Failed to connect to the API server. Please check that the server is running and accessible.");
      }
    } catch (err) {
      console.error("Connection test error:", err);
      setError(`Connection test failed: ${err.message}`);
      setConnectionStatus({ checked: true, success: false });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-blue-600">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96 border border-gray-200 flex flex-col items-center">
        {/* Logo */}
        <img src="/NCC-Logo.png" alt="Company Logo" className="w-32 h-auto mb-4" onError={(e) => {
          e.target.onerror = null;
          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSI+TkNDIExvZ288L3RleHQ+PC9zdmc+';
        }} />

        <h2 className="text-2xl font-bold text-center mb-6">🔑 Login</h2>
        
        {/* Connection Status - only show when there's a problem */}
        {connectionStatus.checked && !connectionStatus.success && (
          <div className="w-full p-2 mb-4 rounded text-center text-sm bg-yellow-100 text-yellow-700 border border-yellow-300">
            ⚠️ Connection problem detected. Try the test button below.
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 w-full text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="w-full">
          <input
            className="border border-gray-300 p-3 w-full mb-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
          />
          <input
            className="border border-gray-300 p-3 w-full mb-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          <button 
            type="submit"
            className={`bg-blue-500 text-white p-3 w-full rounded-md hover:bg-blue-700 transition shadow-md flex justify-center items-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            disabled={isLoading || (!connectionStatus.success && connectionStatus.checked)}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging in...
              </>
            ) : 'Login'}
          </button>
        </form>
        
        {/* No admin credentials shown anymore */}
        
        {/* Connection Test Button - kept for troubleshooting */}
        <button 
          onClick={testConnection}
          className="mt-4 text-xs text-blue-600 underline"
        >
          Test Connection
        </button>
      </div>
    </div>
  );
}