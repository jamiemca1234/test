import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const UserManagement = () => {
  const { getAuthHeader, logActivity, user: currentUser, apiUrl } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Form state for adding/editing users
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    username: "",
    password: "",
    fullName: "",
    role: "staff"
  });
  
  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const baseUrl = apiUrl || 'http://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000';
      const response = await fetch(`${baseUrl}/api/users`, {
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };
  
  // Load users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Reset form to default values
  const resetForm = () => {
    setFormData({
      id: null,
      username: "",
      password: "",
      fullName: "",
      role: "staff"
    });
    setIsEditing(false);
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      const baseUrl = apiUrl || 'https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000';
      
      if (isEditing) {
        // Update existing user
        const updateData = {
          fullName: formData.fullName,
          role: formData.role
        };
        
        // Only include password if it was provided
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        const response = await fetch(`${baseUrl}/api/users/${formData.id}`, {
          method: "PUT",
          headers: {
            ...getAuthHeader(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to update user: ${response.status}`);
        }
        
        // Log activity
        logActivity("user_update", `Updated user: ${formData.username}`);
        
        // Show success message
        alert("User updated successfully");
      } else {
        // Create new user
        const response = await fetch(`${baseUrl}/api/users/register`, {
          method: "POST",
          headers: {
            ...getAuthHeader(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
            fullName: formData.fullName,
            role: formData.role
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to create user: ${response.status}`);
        }
        
        // Log activity
        logActivity("user_create", `Created new user: ${formData.username}`);
        
        // Show success message
        alert("User created successfully");
      }
      
      // Refresh the user list
      fetchUsers();
      
      // Close the form and reset it
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    }
  };
  
  // Open edit form for a user
  const handleEdit = (user) => {
    setFormData({
      id: user.id,
      username: user.username,
      password: "", // Don't pre-fill password
      fullName: user.full_name,
      role: user.role
    });
    setIsEditing(true);
    setShowForm(true);
  };
  
  // Open delete confirmation dialog
  const handleDeleteClick = (user) => {
    // Prevent deleting yourself
    if (user.id === currentUser?.id) {
      return alert("You cannot delete your own account.");
    }
    
    setUserToDelete(user);
    setShowDeleteModal(true);
  };
  
  // Delete user
  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    try {
      const baseUrl = apiUrl || 'http://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000';
      const response = await fetch(`${baseUrl}/api/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: getAuthHeader()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete user: ${response.status}`);
      }
      
      // Log activity
      logActivity("user_delete", `Deleted user: ${userToDelete.username}`);
      
      // Show success message
      alert(`User ${userToDelete.username} was deleted successfully`);
      
      // Refresh users list
      fetchUsers();
      
      // Close modal
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    }
  };
  
  // Handle canceling the form
  const handleCancel = () => {
    setShowForm(false);
    resetForm();
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">User Management</h2>
        
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add New User
          </button>
        )}
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}
      
      {/* User Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">
              {isEditing ? "Edit User" : "Add New User"}
            </h3>
            <button
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to User List
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="p-2 border rounded w-full"
                  required
                  disabled={isEditing} // Cannot change username for existing users
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">
                  {isEditing ? "New Password (leave blank to keep current)" : "Password"}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="p-2 border rounded w-full"
                  required={!isEditing} // Required for new users, optional for edits
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="p-2 border rounded w-full"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="p-2 border rounded w-full"
                >
                  <option value="admin">Administrator</option>
                  <option value="staff">Staff</option>
                  <option value="tech">Technician</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                {isEditing ? "Save Changes" : "Add User"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Users Table */}
      {!showForm && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Full Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 ${currentUser?.id === user.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.username}
                      {currentUser?.id === user.id && (
                        <span className="ml-2 text-xs text-blue-500">(You)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.role === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : user.role === 'tech'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </button>
                      
                      {/* Don't show delete button for current user */}
                      {currentUser?.id !== user.id && (
                        <button
                          onClick={() => handleDeleteClick(user)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm User Deletion</h3>
            <p className="mb-6">
              Are you sure you want to delete user <strong>{userToDelete.username}</strong>? 
              This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Help panel */}
      {!showForm && (
        <div className="mt-6 bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">User Management</h3>
          <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
            <li>Add new users with the "Add New User" button</li>
            <li>Edit existing users by clicking "Edit" in the user list</li>
            <li>Delete users by clicking "Delete" (you cannot delete your own account)</li>
            <li>All users can change their own password from their profile page</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserManagement;