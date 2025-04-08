import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Protected route component that only allows authenticated users
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, hasRole, user, loading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check if authenticated
  if (!isAuthenticated()) {
    // Redirect to login page with the current location
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If role is required, check if the user has the role
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">
            Sorry, {user?.fullName}, you don't have permission to access this page.
            This page requires {requiredRole} privileges.
          </p>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // If all checks pass, render the protected component
  return children;
};

export default ProtectedRoute;