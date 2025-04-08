// Create a new file called utils/userUtils.js

/**
 * Extract initials from a user's full name
 * @param {string} fullName - The user's full name
 * @returns {string} The initials (up to 3 characters)
 */
export const getInitialsFromName = (fullName) => {
    if (!fullName) return '';
    
    // Split the name into parts
    const nameParts = fullName.split(' ');
    
    if (nameParts.length === 1) {
      // Single name, take first two characters
      return nameParts[0].substring(0, 2).toUpperCase();
    } else {
      // Multiple names, take first character of each (up to 3)
      return nameParts
        .slice(0, 3)
        .map(part => part[0])
        .join('')
        .toUpperCase();
    }
  };
  
  /**
   * Pre-populate form fields with user information
   * @param {object} user - The current user object
   * @param {function} setFormData - Function to update form data
   * @param {string} fieldName - Name of the field to update
   */
  export const populateUserInitials = (user, setFormData, fieldName) => {
    if (user && user.fullName) {
      const initials = getInitialsFromName(user.fullName);
      setFormData(prevData => ({
        ...prevData,
        [fieldName]: initials
      }));
    }
  };