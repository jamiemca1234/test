import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const UserProfile = () => {
  const { user, getAuthHeader, logActivity } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State for user information form
  const [formData, setFormData] = useState({
    fullName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // State for activity logs (admin only)
  const [activityLogs, setActivityLogs] = useState([]);
  const [showActivityLogs, setShowActivityLogs] = useState(false);
  
  // State for success/error messages
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/users/profile", {
          headers: getAuthHeader()
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        
        const data = await response.json();
        setProfileData(data);
        
        // Set initial form data
        setFormData(prev => ({
          ...prev,
          fullName: data.full_name || ''
        }));
      } catch (error) {
        console.error("Error fetching profile:", error);
        setMessage({ type: 'error', text: 'Failed to load profile data' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [getAuthHeader]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    // Clear previous messages
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/users/profile`, {
        method: 'PUT',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: formData.fullName
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
      
      // Log activity
      logActivity('profile_update', 'Updated personal profile information');
      
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      
      // Update local profileData
      setProfileData(prev => ({
        ...prev,
        full_name: formData.fullName
      }));
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };
  
  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Clear previous messages
    setMessage({ type: '', text: '' });
    
    // Validation
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      return setMessage({ type: 'error', text: 'All password fields are required' });
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      return setMessage({ type: 'error', text: 'New passwords do not match' });
    }
    
    if (formData.newPassword.length < 6) {
      return setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
    }
    
    try {
      const response = await fetch('https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/users/change-password', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }
      
      // Log activity
      logActivity('password_change', 'Changed account password');
      
      // Success
      setMessage({ type: 'success', text: 'Password changed successfully' });
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };
  
  // Fetch activity logs (admin only)
  const fetchActivityLogs = async () => {
    if (user?.role !== 'admin') return;
    
    try {
      setShowActivityLogs(true);
      
      const response = await fetch("https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/activity", {
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs");
      }
      
      const data = await response.json();
      setActivityLogs(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
      setMessage({ type: 'error', text: 'Failed to load activity logs' });
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };
  
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Your Profile</h2>
      
      {/* Show success/error messages */}
      {message.text && (
        <div className={`mb-6 p-4 rounded ${
          message.type === 'error' 
            ? 'bg-red-100 text-red-700 border border-red-300' 
            : 'bg-green-100 text-green-700 border border-green-300'
        }`}>
          {message.text}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Information Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Your Information</h3>
          
          {profileData && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-500 text-sm">Username</label>
                <div className="font-medium">{profileData.username}</div>
              </div>
              
              <div>
                <label className="block text-gray-500 text-sm">Role</label>
                <div className="font-medium">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    profileData.role === 'admin' 
                      ? 'bg-red-100 text-red-800' 
                      : profileData.role === 'tech'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {profileData.role}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-gray-500 text-sm">Account Created</label>
                <div className="font-medium">{formatDate(profileData.created_at)}</div>
              </div>
              
              {/* Edit name form */}
              <form onSubmit={handleProfileUpdate} className="pt-4 border-t border-gray-200 mt-4">
                <h4 className="font-medium mb-2">Update Your Name</h4>
                
                <div className="mb-4">
                  <label className="block text-gray-500 text-sm mb-1">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="p-2 border rounded w-full"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Update Profile
                </button>
              </form>
              
              {/* Activity logs button (admin only) */}
              {user?.role === 'admin' && (
                <div className="pt-4">
                  <button
                    onClick={fetchActivityLogs}
                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm w-full"
                  >
                    View System Activity Logs
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Change Password Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Change Your Password</h3>
          
          <form onSubmit={handlePasswordChange}>
            <div className="mb-4">
              <label className="block text-gray-500 text-sm mb-1">Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className="p-2 border rounded w-full"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-500 text-sm mb-1">New Password</label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="p-2 border rounded w-full"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-500 text-sm mb-1">Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="p-2 border rounded w-full"
              />
            </div>
            
            <button 
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Change Password
            </button>
          </form>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-blue-800 text-sm">
            <p className="font-medium mb-2">Password Requirements:</p>
            <ul className="list-disc list-inside">
              <li>At least 6 characters long</li>
              <li>Current password is required to make changes</li>
              <li>New password must be confirmed correctly</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Activity Logs (admin only) */}
      {user?.role === 'admin' && showActivityLogs && (
        <div className="mt-6 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">System Activity Logs</h3>
            <button
              onClick={() => setShowActivityLogs(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.username || log.full_name || "Unknown User"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          log.activity_type.includes('login') 
                            ? 'bg-blue-100 text-blue-800' 
                            : log.activity_type.includes('create')
                            ? 'bg-green-100 text-green-800'
                            : log.activity_type.includes('update')
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {log.activity_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;