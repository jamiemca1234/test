import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  // States for dashboard data
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalActive: 0,
    totalCompleted: 0,
    waitingForCustomer: 0,
    onBench: 0,
    revenueToday: 0,
    activeByEngineer: {},
    manufacturerStats: []
  });
  // Status period selector state
  const [statusTimePeriod, setStatusTimePeriod] = useState("7days"); // '7days' or '30days'
  
  const { getAuthHeader, logActivity } = useAuth();

  // Fetch Jobs Data
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch("https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs", {
          headers: getAuthHeader() // Added auth headers
        });
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setJobs(data);
          calculateStatistics(data);
          // Log activity
          logActivity("dashboard_view", "Viewed dashboard statistics");
        }
        setLoading(false);
      } catch (error) {
        console.error("❌ Error fetching dashboard data:", error);
        setLoading(false);
      }
    };
    
    fetchJobs();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [getAuthHeader, logActivity]);
  
  // Filter jobs by date range with timezone safety
  const filterJobsByDateRange = (jobsData, daysAgo) => {
    // Get cutoff date (beginning of day, daysAgo days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    cutoffDate.setHours(0, 0, 0, 0);
    
    return jobsData.filter(job => {
      // Safely parse the job date and normalize to beginning of day
      const jobDateRaw = new Date(job.checked_in_date);
      
      // Create a date at midnight for proper comparison
      const normalizedJobDate = new Date(
        jobDateRaw.getFullYear(), 
        jobDateRaw.getMonth(), 
        jobDateRaw.getDate(), 
        0, 0, 0, 0
      );
      
      return normalizedJobDate >= cutoffDate;
    });
  };
  
  // Get jobs for the selected time period
  const getJobsForTimePeriod = (period) => {
    if (period === "7days") {
      return filterJobsByDateRange(jobs, 7);
    } else if (period === "30days") {
      return filterJobsByDateRange(jobs, 30);
    }
    return jobs;
  };
  
  // Calculate job counts by status for the given time period
  const getStatusCounts = (period) => {
    const filteredJobs = getJobsForTimePeriod(period);
    const statuses = ["On Bench", "Waiting for Customer", "Queued", "Repaired", "Unrepaired"];
    
    return statuses.map(status => {
      const count = filteredJobs.filter(job => job.status === status).length;
      const percentage = filteredJobs.length > 0 ? (count / filteredJobs.length) * 100 : 0;
      return { status, count, percentage };
    });
  };
  
  // Calculate statistics from jobs data
  const calculateStatistics = (jobsData) => {
    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count by status
    const activeJobs = jobsData.filter(job => 
      ["Queued", "On Bench", "Waiting for Customer"].includes(job.status)
    );
    
    const completedJobs = jobsData.filter(job => 
      ["Repaired", "Unrepaired"].includes(job.status)
    );
    
    const waitingForCustomer = jobsData.filter(job => 
      job.status === "Waiting for Customer"
    ).length;
    
    const onBench = jobsData.filter(job => 
      job.status === "On Bench"
    ).length;
    
    // Calculate revenue for today
    const revenueToday = jobsData
      .filter(job => {
        const jobDate = new Date(job.checked_in_date);
        return jobDate >= today;
      })
      .reduce((sum, job) => sum + (parseInt(job.deposit_paid) || 0), 0);
    
    // Calculate manufacturer statistics
    const manufacturerCount = {};
    jobsData.forEach(job => {
      if (job.manufacturer) {
        manufacturerCount[job.manufacturer] = (manufacturerCount[job.manufacturer] || 0) + 1;
      }
    });
    
    // Convert to sorted array
    const manufacturerStats = Object.entries(manufacturerCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    // Initialize engineer workload object
    const activeByEngineer = {};
    
    // For jobs not on bench, we can set statistics immediately
    if (activeJobs.filter(job => job.status === "On Bench").length === 0) {
      setStatistics({
        totalActive: activeJobs.length,
        totalCompleted: completedJobs.length,
        waitingForCustomer,
        onBench,
        revenueToday,
        activeByEngineer,
        manufacturerStats
      });
      return;
    }
    
    // We need to fetch engineer reports for active jobs
    Promise.all(
      activeJobs
        .filter(job => job.status === "On Bench")
        .map(job => 
          fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/engineer-reports/${job.job_ref}`, {
            headers: getAuthHeader()
          })
            .then(res => res.json())
            .catch(() => null)
        )
    ).then(reports => {
      reports.forEach(report => {
        if (report && report.engineer_name) {
          if (!activeByEngineer[report.engineer_name]) {
            activeByEngineer[report.engineer_name] = 0;
          }
          activeByEngineer[report.engineer_name]++;
        }
      });
      
      // Only set statistics after Promise.all resolves
      setStatistics({
        totalActive: activeJobs.length,
        totalCompleted: completedJobs.length,
        waitingForCustomer,
        onBench,
        revenueToday,
        activeByEngineer,
        manufacturerStats
      });
    }).catch(error => {
      console.error("❌ Error fetching engineer reports:", error);
      // Set statistics even on error
      setStatistics({
        totalActive: activeJobs.length,
        totalCompleted: completedJobs.length,
        waitingForCustomer,
        onBench,
        revenueToday,
        activeByEngineer: {},
        manufacturerStats
      });
    });
  };

  // Get the 5 most recent jobs
  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.checked_in_date) - new Date(a.checked_in_date))
    .slice(0, 5);
  
  // Function to get appropriate status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Repaired":
        return "bg-green-500";
      case "Unrepaired":
        return "bg-red-500";
      case "Waiting for Customer":
        return "bg-yellow-500";
      case "On Bench":
        return "bg-blue-500";
      default:
        return "bg-gray-500"; // Queued or other
    }
  };
  
  // Get manufacturers color palette
  const getManufacturerColor = (index) => {
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-red-500", 
      "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"
    ];
    return colors[index % colors.length];
  };
  
  // Calculate the maximum count for scaling the manufacturer chart
  const maxManufacturerCount = statistics.manufacturerStats.length > 0
    ? statistics.manufacturerStats[0].count
    : 0;
  
  // Handle quick job status updates
  const handleStatusUpdate = async (jobRef, newStatus) => {
    try {
      // Get current job data
      const job = jobs.find(j => j.job_ref === jobRef);
      if (!job) return;
      
      // Update status
      const response = await fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs/${jobRef}`, {
        method: "PUT",
        headers: {
          ...getAuthHeader(), // Added auth headers
          "Content-Type": "application/json"
        },
        body: JSON.stringify({...job, status: newStatus})
      });
      
      if (response.ok) {
        // Log activity
        logActivity("job_status_update", `Updated job #${jobRef} status to ${newStatus}`);
        
        // Update local state
        setJobs(prev => prev.map(j => 
          j.job_ref === jobRef ? {...j, status: newStatus} : j
        ));
        
        // Recalculate statistics
        calculateStatistics(jobs.map(j => 
          j.job_ref === jobRef ? {...j, status: newStatus} : j
        ));
      }
    } catch (error) {
      console.error("❌ Error updating status:", error);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    };
    return new Date(dateString).toLocaleDateString('en-GB', options);
  };
  
  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Loading Dashboard...</h2>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-24 bg-blue-100 rounded"></div>
            <div className="h-24 bg-blue-100 rounded"></div>
            <div className="h-24 bg-blue-100 rounded"></div>
            <div className="h-24 bg-blue-100 rounded"></div>
          </div>
          <div className="h-64 bg-blue-100 rounded"></div>
          <div className="h-64 bg-blue-100 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Workshop Dashboard</h2>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Total Active Jobs Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2">
            <h3 className="text-white text-sm font-semibold">ACTIVE JOBS</h3>
          </div>
          <div className="p-4">
            <p className="text-3xl font-bold text-gray-800">{statistics.totalActive}</p>
            <div className="flex justify-between mt-4 text-xs text-gray-500">
              <span>On Bench: {statistics.onBench}</span>
              <span>Waiting: {statistics.waitingForCustomer}</span>
            </div>
          </div>
        </div>
        
        {/* Completed Jobs Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-2">
            <h3 className="text-white text-sm font-semibold">COMPLETED JOBS</h3>
          </div>
          <div className="p-4">
            <p className="text-3xl font-bold text-gray-800">{statistics.totalCompleted}</p>
            <p className="text-xs text-gray-500 mt-4">Total job completion count</p>
          </div>
        </div>
        
        {/* Today's Revenue Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-2">
            <h3 className="text-white text-sm font-semibold">TODAY'S DEPOSIT</h3>
          </div>
          <div className="p-4">
            <p className="text-3xl font-bold text-gray-800">£{statistics.revenueToday}</p>
            <p className="text-xs text-gray-500 mt-4">Total deposits for today's jobs</p>
          </div>
        </div>
        
        {/* Quick Actions Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2">
            <h3 className="text-white text-sm font-semibold">QUICK ACTIONS</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2">
              <Link to="/new-job" className="bg-blue-500 text-white text-center py-2 px-4 rounded text-sm hover:bg-blue-600 transition-colors">
                New Job
              </Link>
              <Link to="/view-jobs" className="bg-green-500 text-white text-center py-2 px-4 rounded text-sm hover:bg-green-600 transition-colors">
                View Jobs
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Job Status & Manufacturer Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Status Chart with Date Period Filtering */}
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="border-b p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Status Distribution</h3>
              <div className="flex space-x-2 text-sm">
                <button 
                  className={`px-3 py-1 rounded-full ${statusTimePeriod === "7days" 
                    ? "bg-blue-500 text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                  onClick={() => setStatusTimePeriod("7days")}
                >
                  Last 7 Days
                </button>
                <button 
                  className={`px-3 py-1 rounded-full ${statusTimePeriod === "30days" 
                    ? "bg-blue-500 text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                  onClick={() => setStatusTimePeriod("30days")}
                >
                  Last 30 Days
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center space-x-2 mb-4 flex-wrap">
              {["On Bench", "Waiting for Customer", "Queued", "Repaired", "Unrepaired"].map(status => (
                <div key={status} className="flex items-center mr-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} mr-1`}></div>
                  <span className="text-xs">{status}</span>
                </div>
              ))}
            </div>
            
            {/* Job count summary for the selected period */}
            <div className="text-sm text-gray-500 mb-2">
              {statusTimePeriod === "7days" ? "Jobs in the last 7 days: " : "Jobs in the last 30 days: "}
              <span className="font-semibold">
                {getJobsForTimePeriod(statusTimePeriod).length}
              </span>
            </div>
            
            <div className="flex h-8 rounded-lg overflow-hidden">
              {getStatusCounts(statusTimePeriod).map(({ status, count, percentage }) => (
                <div
                  key={status}
                  className={`${getStatusColor(status)} relative group`}
                  style={{ width: `${percentage}%`, minWidth: percentage > 0 ? '4px' : '0' }}
                >
                  {percentage > 8 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                      {Math.round(percentage)}%
                    </span>
                  )}
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 mb-1 whitespace-nowrap z-10">
                    {status}: {count} jobs ({percentage.toFixed(1)}%)
                  </div>
                </div>
              ))}
            </div>
            
            {/* Status breakdown as a list */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {getStatusCounts(statusTimePeriod).map(({ status, count }) => (
                <div key={status} className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(status)} mr-2`}></div>
                    <span>{status}</span>
                  </div>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Manufacturer Distribution Chart */}
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="border-b p-4">
            <h3 className="text-lg font-semibold">Manufacturer Breakdown</h3>
          </div>
          
          <div className="p-4">
            {statistics.manufacturerStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                <svg xmlns="https://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No manufacturer data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statistics.manufacturerStats.slice(0, 6).map((item, index) => (
                  <div key={item.name} className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span>{item.count} jobs</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${getManufacturerColor(index)}`} 
                        style={{ width: `${(item.count / maxManufacturerCount) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Engineers & Most Common Repairs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Engineers Workload */}
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="border-b p-4">
            <h3 className="text-lg font-semibold">Engineers' Active Jobs</h3>
          </div>
          <div className="p-4">
            {Object.keys(statistics.activeByEngineer).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <svg xmlns="https://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p>No engineers currently assigned to jobs</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {Object.entries(statistics.activeByEngineer).map(([engineer, count]) => (
                  <li key={engineer} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center">
                      <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-semibold mr-3">
                        {engineer.charAt(0).toUpperCase()}
                      </div>
                      <span>{engineer}</span>
                    </div>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      {count} {count === 1 ? 'job' : 'jobs'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Device Types */}
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <div className="border-b p-4">
            <h3 className="text-lg font-semibold">Common Device Types</h3>
          </div>
          <div className="p-4">
            {(() => {
              // Calculate device type frequencies
              const deviceTypes = {};
              jobs.forEach(job => {
                if (job.device_type) {
                  deviceTypes[job.device_type] = (deviceTypes[job.device_type] || 0) + 1;
                }
              });

              const sortedDevices = Object.entries(deviceTypes)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
                
              return sortedDevices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <svg xmlns="https://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p>No device type data available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sortedDevices.map(device => (
                    <div key={device.name} className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-blue-700">{device.count}</div>
                      <div className="text-xs text-blue-600 truncate">{device.name}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      
      {/* Recent Jobs */}
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
        <div className="border-b p-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Recent Jobs</h3>
          <Link to="/view-jobs" className="text-blue-500 hover:text-blue-700 text-sm">
            View All Jobs →
          </Link>
        </div>
        <div className="overflow-x-auto">
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <svg xmlns="https://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No jobs available yet</p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentJobs.map(job => (
                  <tr key={job.job_ref} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{job.job_ref}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{job.customer_name || "N/A"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {job.manufacturer} {job.device_type}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(job.checked_in_date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link to={`/new-job/${job.job_ref}`} className="text-blue-600 hover:text-blue-900">
                        Edit
                      </Link>
                      {job.status !== "Repaired" && (
                        <button 
                          onClick={() => handleStatusUpdate(job.job_ref, "Repaired")}
                          className="text-green-600 hover:text-green-900"
                        >
                          Mark Repaired
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    
    {/* Auto-refresh notification */}
    <div className="mt-6 text-center text-xs text-gray-500">
      <p>Dashboard auto-refreshes every 30 seconds</p>
    </div>
  </div>
);
};

export default Dashboard;