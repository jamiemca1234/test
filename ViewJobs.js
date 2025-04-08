import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ViewJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date"); // Default sort by date
  const [sortOrder, setSortOrder] = useState("desc"); // Default newest first
  const [activeTab, setActiveTab] = useState("current");
  const [loading, setLoading] = useState(true);
  const [smsCounts, setSmsCounts] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    manufacturer: "",
    deviceType: "",
    dateRange: "all"
  });
  
  const navigate = useNavigate();
  const { getAuthHeader, logActivity } = useAuth();

  // Fetch jobs with loading state
  const refreshJobs = () => {
    setLoading(true);
    fetch("https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs", {
      headers: getAuthHeader()
    })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          console.log("✅ Jobs Loaded:", data);
          setJobs(data);
          
          // Get job refs to fetch SMS counts
          const jobRefs = data.map(job => job.job_ref);
          fetchSMSCounts(jobRefs);
        } else {
          console.error("❌ Invalid API Response:", data);
          setJobs([]);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("❌ Error fetching jobs:", error);
        setJobs([]);
        setLoading(false);
      });
  };

// Fetch SMS counts for all jobs
const fetchSMSCounts = async (jobRefs) => {
  try {
    // Skip API call if there are no jobs
    if (!jobRefs || jobRefs.length === 0) {
      setSmsCounts({});
      return;
    }
    
    const response = await fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/sms-counts`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jobRefs })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    setSmsCounts(data);
  } catch (error) {
    console.error("Error fetching SMS counts:", error);
    // In case of error, set empty counts to avoid UI issues
    setSmsCounts({});
  }
};

  // Auto-refresh every 90 seconds (increased from 5 to reduce server load)
  useEffect(() => {
    refreshJobs();
    const interval = setInterval(refreshJobs, 90000);
    return () => clearInterval(interval);
  }, []);

  // Handle job selection
  const handleJobClick = (job) => {
    logActivity("job_view", `Viewed job #${job.job_ref}`);
    navigate(`/new-job/${job.job_ref}`, { state: { selectedJob: job } });
  };

  // Quick action to mark job as repaired
  const handleMarkRepaired = (e, job) => {
    e.stopPropagation(); // Prevent row click
    
    const updatedJob = { ...job, status: "Repaired" };
    
    fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs/${job.job_ref}`, {
      method: "PUT",
      headers: {
        ...getAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatedJob)
    })
      .then(response => {
        if (response.ok) {
          logActivity("job_status_update", `Updated job #${job.job_ref} status to Repaired`);
          
          // Update local state
          setJobs(prev => 
            prev.map(j => j.job_ref === job.job_ref ? updatedJob : j)
          );
        }
      })
      .catch(error => console.error("Error updating job:", error));
  };

  // Handle sending SMS
  const handleSendSMS = (e, job) => {
    e.stopPropagation(); // Prevent row click
    
    // Navigate to the job edit page with SMS tab active
    navigate(`/new-job/${job.job_ref}`, { 
      state: { 
        selectedJob: job,
        openSmsDialog: true
      } 
    });
  };

  // Get unique manufacturers and device types for filters
  const manufacturers = useMemo(() => {
    const unique = [...new Set(jobs.map(job => job.manufacturer).filter(Boolean))];
    return unique.sort();
  }, [jobs]);
  
  const deviceTypes = useMemo(() => {
    const unique = [...new Set(jobs.map(job => job.device_type).filter(Boolean))];
    return unique.sort();
  }, [jobs]);

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    // First filter by search query
    let filtered = jobs.filter((job) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        job.job_ref.toString().includes(searchQuery) ||
        (job.customer_name && job.customer_name.toLowerCase().includes(searchLower)) ||
        (job.contact_number && job.contact_number.includes(searchQuery)) ||
        (job.device_type && job.device_type.toLowerCase().includes(searchLower)) ||
        (job.manufacturer && job.manufacturer.toLowerCase().includes(searchLower))
      );
    });
    
    // Apply additional filters
    if (filters.manufacturer) {
      filtered = filtered.filter(job => job.manufacturer === filters.manufacturer);
    }
    
    if (filters.deviceType) {
      filtered = filtered.filter(job => job.device_type === filters.deviceType);
    }
    
    if (filters.dateRange !== "all") {
      const now = new Date();
      const cutoffDate = new Date();
      
      if (filters.dateRange === "today") {
        cutoffDate.setHours(0, 0, 0, 0);
      } else if (filters.dateRange === "week") {
        cutoffDate.setDate(now.getDate() - 7);
      } else if (filters.dateRange === "month") {
        cutoffDate.setMonth(now.getMonth() - 1);
      }
      
      filtered = filtered.filter(job => {
        const jobDate = new Date(job.checked_in_date);
        return jobDate >= cutoffDate;
      });
    }
    
    // Then sort
    return filtered.sort((a, b) => {
      if (sortBy === "date") {
        const dateA = new Date(a.checked_in_date);
        const dateB = new Date(b.checked_in_date);
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      } else if (sortBy === "id") {
        return sortOrder === "asc" ? a.job_ref - b.job_ref : b.job_ref - a.job_ref;
      } else if (sortBy === "name") {
        const nameA = a.customer_name ? a.customer_name.toLowerCase() : "";
        const nameB = b.customer_name ? b.customer_name.toLowerCase() : "";
        return sortOrder === "asc" 
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }
      return 0;
    });
  }, [jobs, searchQuery, sortBy, sortOrder, filters]);

  // Filter by status tabs
  const currentJobs = filteredAndSortedJobs.filter((job) =>
    ["Queued", "On Bench", "Waiting for Customer"].includes(job.status)
  );
  
  const completedJobs = filteredAndSortedJobs.filter((job) =>
    ["Repaired", "Unrepaired"].includes(job.status)
  );

  // Status badge styling
  const getStatusBadge = (status) => {
    let bgColor, textColor, icon;
    
    switch (status) {
      case "Repaired":
        bgColor = "bg-green-100 border-green-500";
        textColor = "text-green-800";
        icon = "✓";
        break;
      case "Unrepaired":
        bgColor = "bg-red-100 border-red-500";
        textColor = "text-red-800";
        icon = "✗";
        break;
      case "Waiting for Customer":
        bgColor = "bg-yellow-100 border-yellow-500";
        textColor = "text-yellow-800";
        icon = "⌛";
        break;
      case "On Bench":
        bgColor = "bg-blue-100 border-blue-500";
        textColor = "text-blue-800";
        icon = "🔧";
        break;
      default: // "Queued"
        bgColor = "bg-gray-100 border-gray-500";
        textColor = "text-gray-800";
        icon = "⏱";
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgColor} ${textColor}`}>
        <span className="mr-1">{icon}</span>
        {status}
      </span>
    );
  };

  // Format date for better readability
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    
    // Format time
    const timeString = date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
    
    // Today
    if (date.toDateString() === now.toDateString()) {
      return `Today, ${timeString}`;
    }
    
    // Yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${timeString}`;
    }
    
    // This week (less than 7 days ago)
    const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return `${date.toLocaleDateString('en-GB', { weekday: 'short' })}, ${timeString}`;
    }
    
    // Default format for older dates
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric'
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800 flex items-center">
        <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        View Jobs
      </h2>

      {/* Search, Sort, and Filter Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          {/* Search Bar */}
          <div className="relative flex-grow max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search jobs by ID, customer, device..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Sort Controls */}
          <div className="flex space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Sort by Date</option>
              <option value="id">Sort by Job ID</option>
              <option value="name">Sort by Customer</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg transition-colors"
            >
              {sortOrder === "desc" ? (
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Newest
                </span>
              ) : (
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  Oldest
                </span>
              )}
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {Object.values(filters).some(f => f && f !== "all") && (
                <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
        
        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-gray-50 p-4 mt-2 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
              <select
                value={filters.manufacturer}
                onChange={(e) => setFilters({...filters, manufacturer: e.target.value})}
                className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Manufacturers</option>
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
              <select
                value={filters.deviceType}
                onChange={(e) => setFilters({...filters, deviceType: e.target.value})}
                className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Device Types</option>
                {deviceTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
            
            <div className="md:col-span-3 flex justify-end">
              <button
                onClick={() => setFilters({manufacturer: "", deviceType: "", dateRange: "all"})}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-3 ${
            activeTab === "current" 
              ? "border-b-2 border-blue-500 text-blue-600 font-medium" 
              : "text-gray-500 hover:text-gray-700"
          } transition-colors focus:outline-none`}
          onClick={() => setActiveTab("current")}
        >
          <span className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Current Jobs
            <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {currentJobs.length}
            </span>
          </span>
        </button>
        <button
          className={`px-4 py-3 ${
            activeTab === "completed" 
              ? "border-b-2 border-green-500 text-green-600 font-medium" 
              : "text-gray-500 hover:text-gray-700"
          } transition-colors focus:outline-none`}
          onClick={() => setActiveTab("completed")}
        >
          <span className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Completed Jobs
            <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {completedJobs.length}
            </span>
          </span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Job Listings in Card Format */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === "current" ? 
            (currentJobs.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-xl">No current jobs found</p>
                <p className="text-sm mt-2">Try adjusting your search or filters</p>
              </div>
            ) : (
              currentJobs.map((job) => (
                <div 
                  key={job.job_ref}
                  className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer transform hover:-translate-y-1 transition-transform duration-200"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900 text-lg">
                          Job #{job.job_ref}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {formatDate(job.checked_in_date)}
                        </p>
                      </div>
                      <div>
                        {getStatusBadge(job.status)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="mb-3">
                      <div className="text-sm text-gray-500 font-medium">Customer</div>
                      <div className="font-medium">{job.customer_name || "N/A"}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-sm text-gray-500 font-medium">Device</div>
                        <div>{job.manufacturer} {job.device_type || "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 font-medium">Contact</div>
                        <div>{job.contact_number || "N/A"}</div>
                      </div>
                      <div>
                      <div className="text-sm text-gray-500 font-medium">Serial Number</div>
                      <div>{job.serial_number || "N/A"}</div>
                      </div>
                    
                    </div>
                    
                    {/* Job details preview */}
                    {job.job_details && (
                      <div className="mb-3">
                        <div className="text-sm text-gray-500 font-medium">Details</div>
                        <div className="text-sm text-gray-700 line-clamp-2">
                          {job.job_details}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 px-4 py-3 flex justify-between">
                    <div className="flex space-x-2">
                      {/* Quick action buttons */}
                      <button
                        onClick={(e) => handleMarkRepaired(e, job)}
                        className="text-sm bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded flex items-center transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mark Repaired
                      </button>
                      
                      <button
                        onClick={(e) => handleSendSMS(e, job)}
                        className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded flex items-center transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        SMS
                      </button>
                    </div>
                    
                    {/* SMS notification indicator */}
                    {smsCounts[job.job_ref] && (
                      <div className="flex items-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-blue-100 bg-blue-600 rounded-full">
                          {smsCounts[job.job_ref]}
                        </span>
                        <span className="ml-1 text-xs text-gray-500">SMS sent</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )) : (
            
            completedJobs.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-xl">No completed jobs found</p>
                <p className="text-sm mt-2">Try adjusting your search or filters</p>
              </div>
            ) : (
              completedJobs.map((job) => (
                <div 
                  key={job.job_ref}
                  className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer transform hover:-translate-y-1 transition-transform duration-200"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900 text-lg">
                          Job #{job.job_ref}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {formatDate(job.checked_in_date)}
                        </p>
                      </div>
                      <div>
                        {getStatusBadge(job.status)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="mb-3">
                      <div className="text-sm text-gray-500 font-medium">Customer</div>
                      <div className="font-medium">{job.customer_name || "N/A"}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-sm text-gray-500 font-medium">Device</div>
                        <div>{job.manufacturer} {job.device_type || "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 font-medium">Contact</div>
                        <div>{job.contact_number || "N/A"}</div>
                      </div>
                    </div>
                    
                    {/* Job details preview */}
                    {job.job_details && (
                      <div className="mb-3">
                        <div className="text-sm text-gray-500 font-medium">Details</div>
                        <div className="text-sm text-gray-700 line-clamp-2">
                          {job.job_details}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 px-4 py-3 flex justify-between">
                    <div className="flex space-x-2">
                      {/* Show completion date for completed jobs */}
                      <div className="text-sm text-gray-600">
                        Completed: {formatDate(job.updated_at || job.checked_in_date)}
                      </div>
                    </div>
                    
                    {/* SMS notification indicator */}
                    {smsCounts[job.job_ref] && (
                      <div className="flex items-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-blue-100 bg-blue-600 rounded-full">
                          {smsCounts[job.job_ref]}
                        </span>
                        <span className="ml-1 text-xs text-gray-500">SMS sent</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ))
          }
        </div>
      )}

      {/* Alternative Table View - Only shown on large screens and when no search results */}
      {!loading && activeTab === "current" && currentJobs.length === 0 && !searchQuery && (
        <div className="mt-8 hidden lg:block">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Recent Completed Jobs</h3>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {completedJobs.slice(0, 5).map((job) => (
                  <tr 
                    key={job.job_ref}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleJobClick(job)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">#{job.job_ref}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{job.customer_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{job.manufacturer} {job.device_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(job.updated_at || job.checked_in_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Tips Panel */}
      <div className="mt-8 bg-blue-50 rounded-lg p-4 border border-blue-100">
        <h3 className="text-lg font-medium text-blue-800 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Quick Tips
        </h3>
        <div className="mt-2 text-sm text-blue-700">
          <ul className="list-disc list-inside space-y-1">
            <li>Click or tap on a job card to view and edit its details</li>
            <li>Use filters to find specific jobs</li>
            <li>Jobs are automatically refreshed every 90 seconds</li>
            <li>Use "Mark Repaired" to quickly update a job's status</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ViewJobs;