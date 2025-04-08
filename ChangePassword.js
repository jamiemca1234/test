// Create a new file called components/ChangePassword.js

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  
  const { getAuthHeader, logActivity } = useAuth();
  
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Reset message
    setMessage({ type: '', text: '' });
    
    // Validate
    if (!currentPassword || !newPassword || !confirmPassword) {
      return setMessage({ type: 'error', text: 'All fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
      return setMessage({ type: 'error', text: 'New passwords do not match' });
    }
    
    if (newPassword.length < 6) {
      return setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('http://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/users/change-password', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }
      
      // Success
      setMessage({ type: 'success', text: 'Password changed successfully' });
      logActivity('password_change', 'Changed password');
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white p-6 shadow-md rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Change Your Password</h2>
      
      {message.text && (
        <div className={`mb-4 p-3 rounded ${
          message.type === 'error' 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handlePasswordChange}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-1">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="p-2 border rounded w-full"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-1">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="p-2 border rounded w-full"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-1">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="p-2 border rounded w-full"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className={`bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Changing Password...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;