// AuthContext.js - Simplified approach

import React, { createContext, useState, useEffect, useContext } from "react";

// Create Auth Context
const AuthContext = createContext();

// API URLs to try, in order of preference
const API_URLS = [
  'https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000',
];

// You can override this with an environment variable
const API_BASE = process.env.REACT_APP_API_URL || API_URLS[0];

// Create Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiUrl, setApiUrl] = useState(API_BASE);

  // Try to connect to each API URL until one works
  useEffect(() => {
    const checkConnections = async () => {
      for (const url of API_URLS) {
        try {
          console.log(`Testing connection to: ${url}`);
          const response = await fetch(`${url}/api/health`, { 
            method: 'GET',
            cache: 'no-store'
          });
          
          if (response.ok) {
            console.log(`Connection successful to ${url}`);
            setApiUrl(url);
            return;
          }
        } catch (error) {
          console.error(`Connection test failed for ${url}:`, error);
        }
      }
      
      console.log("All connection attempts failed, using default URL");
    };
    
    checkConnections();
  }, []);

  // Add token refresh interval to handle token expiration proactively
  useEffect(() => {
    // Only set up refresh interval if user is logged in
    if (!user) return;
    
    console.log("Setting up token refresh interval");
    
    // Refresh token every 24 hours (86400000 ms)
    const refreshInterval = setInterval(async () => {
      try {
        await refreshAuthToken();
      } catch (error) {
        console.error("Scheduled token refresh failed:", error);
      }
    }, 86400000); // 24 hours
    
    return () => clearInterval(refreshInterval);
  }, [user]);

  // Check for existing token on load
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("user");
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user data");
        localStorage.removeItem("user");
        localStorage.removeItem("auth_token");
      }
    }
    setLoading(false);
  }, []);

  // Token refresh function
  const refreshAuthToken = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      
      if (!token) {
        return false;
      }
      
      console.log("Attempting to refresh token...");
      const response = await fetch(`${apiUrl}/api/users/refresh-token`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error("Token refresh failed:", response.status);
        return false;
      }
      
      const data = await response.json();
      localStorage.setItem("auth_token", data.token);
      console.log("Token refreshed successfully");
      return true;
    } catch (err) {
      console.error("Token refresh error:", err);
      return false;
    }
  };

  // Login function with improved error handling
  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Attempting login at: ${apiUrl}/api/users/login`);
      
      const response = await fetch(`${apiUrl}/api/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      // Get response text first to handle invalid JSON
      const responseText = await response.text();
      let data;
      
      try {
        // Try to parse JSON
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Invalid JSON response:", responseText);
        throw new Error("Server returned an invalid response. Check connection or server logs.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Save token and user data
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      
      // Log activity
      logActivity("login", "User logged in").catch(console.error);
      
      return data;
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
      
      // If fetch failed completely, it might be a connection issue
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        throw new Error(`Connection failed. Please ensure the server is running at ${apiUrl} and your network connection is active.`);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    // Try to log activity but don't wait for it
    logActivity("logout", "User logged out").catch(console.error);
    
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    setUser(null);
  };

  // Register new user function (Admin only)
  const registerUser = async (userData) => {
    try {
      const token = localStorage.getItem("auth_token");
      
      if (!token) {
        throw new Error("Not authenticated");
      }
      
      const response = await fetch(`${apiUrl}/api/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      return data;
    } catch (err) {
      throw err;
    }
  };

  // Get current user profile
  const getCurrentUser = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      
      if (!token) {
        throw new Error("Not authenticated");
      }
      
      const response = await fetch(`${apiUrl}/api/users/me`, {
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get user data");
      }

      return data;
    } catch (err) {
      throw err;
    }
  };

  // Log activity
  const logActivity = async (activityType, details) => {
    try {
      const token = localStorage.getItem("auth_token");
      
      if (!token) return; // Silent fail if not logged in
      
      await fetch(`${apiUrl}/api/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ activityType, details }),
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
      // Don't throw - we don't want this to break app flow
    }
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!user;
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return user && user.role === role;
  };

  // Generate auth header for API calls
  const getAuthHeader = () => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Provide all auth values and functions
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        registerUser,
        getCurrentUser,
        isAuthenticated,
        hasRole,
        getAuthHeader,
        logActivity,
        apiUrl,
        refreshAuthToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;