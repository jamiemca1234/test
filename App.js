import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { useState, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Immediate load for Login component (first screen users see)
import Login from "./pages/Login";

// Lazy load other components to improve initial load time
const Dashboard = lazy(() => import("./pages/dashboard"));
const NewJob = lazy(() => import("./pages/NewJob"));
const ViewJobs = lazy(() => import("./pages/ViewJobs"));
const EngineerReport = lazy(() => import("./pages/EngineerReport"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const UserProfile = lazy(() => import("./pages/UserProfile"));

//loading icon
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

const Navigation = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Only show navigation when authenticated
  if (!isAuthenticated()) return null;
  
  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-3 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo and brand */}
        <div className="flex items-center space-x-2">
          <img 
            src="/NCC-Logo-nobg (2).png" 
            alt="NCC Logo" 
            className="h-8 w-auto" 
            onError={(e) => {
              e.target.onerror = null;
              // Fallback to icon if image fails to load
              e.target.style.display = 'none';
              const icon = document.createElement('svg');
              icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
              icon.setAttribute('className', 'h-8 w-8');
              icon.setAttribute('fill', 'none');
              icon.setAttribute('viewBox', '0 0 24 24');
              icon.setAttribute('stroke', 'currentColor');
              icon.innerHTML = '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />';
              e.target.parentNode.prepend(icon);
            }}
          />
          <h1 className="text-xl font-bold hidden sm:block"></h1>
        </div>
        
        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center space-x-6">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => 
              isActive 
                ? "text-white font-medium border-b-2 border-white pb-1" 
                : "text-blue-100 hover:text-white transition-colors"
            }
          >
            Dashboard
          </NavLink>
          
          <NavLink 
            to="/new-job" 
            className={({ isActive }) => 
              isActive 
                ? "text-white font-medium border-b-2 border-white pb-1" 
                : "text-blue-100 hover:text-white transition-colors"
            }
          >
            New Job
          </NavLink>
          
          <NavLink 
            to="/view-jobs" 
            className={({ isActive }) => 
              isActive 
                ? "text-white font-medium border-b-2 border-white pb-1" 
                : "text-blue-100 hover:text-white transition-colors"
            }
          >
            Jobs
          </NavLink>
          
          {/* Only show Users link for admins */}
          {user?.role === 'admin' && (
            <NavLink 
              to="/users" 
              className={({ isActive }) => 
                isActive 
                  ? "text-white font-medium border-b-2 border-white pb-1" 
                  : "text-blue-100 hover:text-white transition-colors"
              }
            >
              Users
            </NavLink>
          )}
          
          {/* User profile dropdown */}
          <div className="relative group ml-4">
            <button className="flex items-center bg-white bg-opacity-20 rounded-full px-3 py-1 hover:bg-opacity-30 transition-colors">
              <span className="text-sm mr-1 font-medium">
                {user?.fullName || user?.username}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white text-gray-800 rounded-md shadow-lg overflow-hidden invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
              <NavLink 
                to="/profile" 
                className="block px-4 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </div>
              </NavLink>
              
              <div className="border-t border-gray-200"></div>
              
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition-colors"
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </div>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu button */}
        <button 
          className="md:hidden text-white focus:outline-none"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden mt-2 pt-2 border-t border-blue-400 border-opacity-50">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => 
              `block py-2 px-4 ${isActive ? 'bg-blue-700' : 'hover:bg-blue-700'} transition-colors`
            }
            onClick={() => setIsMenuOpen(false)}
          >
            Dashboard
          </NavLink>
          
          <NavLink 
            to="/new-job" 
            className={({ isActive }) => 
              `block py-2 px-4 ${isActive ? 'bg-blue-700' : 'hover:bg-blue-700'} transition-colors`
            }
            onClick={() => setIsMenuOpen(false)}
          >
            New Job
          </NavLink>
          
          <NavLink 
            to="/view-jobs" 
            className={({ isActive }) => 
              `block py-2 px-4 ${isActive ? 'bg-blue-700' : 'hover:bg-blue-700'} transition-colors`
            }
            onClick={() => setIsMenuOpen(false)}
          >
            Jobs
          </NavLink>
          
          {user?.role === 'admin' && (
            <NavLink 
              to="/users" 
              className={({ isActive }) => 
                `block py-2 px-4 ${isActive ? 'bg-blue-700' : 'hover:bg-blue-700'} transition-colors`
              }
              onClick={() => setIsMenuOpen(false)}
            >
              Users
            </NavLink>
          )}
          
          <NavLink 
            to="/profile" 
            className={({ isActive }) => 
              `block py-2 px-4 ${isActive ? 'bg-blue-700' : 'hover:bg-blue-700'} transition-colors`
            }
            onClick={() => setIsMenuOpen(false)}
          >
            My Profile
          </NavLink>
          
          <button
            onClick={() => {
              logout();
              setIsMenuOpen(false);
            }}
            className="block w-full text-left py-2 px-4 text-red-200 hover:bg-red-700 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
};

export default function App() {
  const [selectedJob, setSelectedJob] = useState(null);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navigation />

          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Public route */}
              <Route path="/" element={<Login />} />
              
              {/* Protected routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/new-job" 
                element={
                  <ProtectedRoute>
                    <NewJob />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/new-job/:jobRef" 
                element={
                  <ProtectedRoute>
                    <NewJob selectedJob={selectedJob} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/view-jobs" 
                element={
                  <ProtectedRoute>
                    <ViewJobs onSelectJob={setSelectedJob} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/engineer-report/:jobRef" 
                element={
                  <ProtectedRoute>
                    <EngineerReport />
                  </ProtectedRoute>
                } 
              />
              
              {/* User Profile route - accessible to all authenticated users */}
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <UserProfile />
                  </ProtectedRoute>
                } 
              />
              
              {/* Admin-only route */}
              <Route 
                path="/users" 
                element={
                  <ProtectedRoute requiredRole="admin">
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />
              
              {/* Catch-all route */}
              <Route 
                path="*" 
                element={
                  <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
                      <p className="mb-4">The page you're looking for doesn't exist.</p>
                      <NavLink to="/dashboard" className="text-blue-600 hover:underline">
                        Return to Dashboard
                      </NavLink>
                    </div>
                  </div>
                } 
              />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}