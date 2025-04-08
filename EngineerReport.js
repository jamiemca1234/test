import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useAuth } from "../context/AuthContext";

// Helper function to get initials from a user's full name
const getInitialsFromName = (fullName) => {
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

const EngineerReport = () => {
  // Get jobRef from both URL params and location state
  const { jobRef } = useParams();
  const location = useLocation();
  const stateJobRef = location.state?.job_ref;
  
  // Use the jobRef from URL params or from state
  const job_ref = jobRef || stateJobRef || "";

  const [jobData, setJobData] = useState(null);
  const [reportData, setReportData] = useState({
    job_ref: job_ref,
    engineer_name: "",
    time_spent: "",
    repair_notes: "",
    status: "On Bench",
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getAuthHeader, logActivity, user } = useAuth();

  useEffect(() => {
    if (job_ref) {
      console.log("✅ Job Ref from URL/State:", job_ref);
      setReportData((prev) => ({ ...prev, job_ref }));

      // Fetch job data first
      setLoading(true);
      fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs/${job_ref}`, {
        headers: getAuthHeader()
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch job data (Status: ${response.status})`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("✅ Loaded Job Data:", data);
          setJobData(data);
          
          // Then fetch engineer report
          return fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/engineer-reports/${job_ref}`, {
            headers: getAuthHeader()
          });
        })
        .then((response) => {
          // Skip error for 404 (report might not exist yet)
          if (!response.ok && response.status !== 404) {
            throw new Error(`Failed to fetch engineer report (Status: ${response.status})`);
          }
          return response.json();
        })
        .then((data) => {
          if (data && data.job_ref) {
            console.log("✅ Loaded Engineer Report:", data);
            setReportData(data);
          } else {
            console.log("✅ No existing report, creating new one");
            // Auto-populate engineer_name with user initials for new reports
            if (user && user.fullName) {
              const initials = getInitialsFromName(user.fullName);
              setReportData(prev => ({
                ...prev, 
                job_ref,
                engineer_name: initials
              }));
            } else {
              setReportData(prev => ({...prev, job_ref}));
            }
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error("❌ Error in data fetching:", error);
          setError(error.message);
          setLoading(false);
        });
    } else {
      setError("Job reference is missing. Please select a job first.");
      setLoading(false);
    }
  }, [job_ref, getAuthHeader, user]);

  // Auto-populate engineer_name with user initials if it's empty
  useEffect(() => {
    if (!reportData.engineer_name && user && user.fullName) {
      const initials = getInitialsFromName(user.fullName);
      setReportData(prev => ({
        ...prev,
        engineer_name: initials
      }));
    }
  }, [reportData.engineer_name, user]);

  // Handle Input Changes
  const handleChange = (e) => {
    setReportData({ ...reportData, [e.target.name]: e.target.value });
  };

  // Handle Work Done Notes Update
  const handleQuillChange = (value) => {
    setReportData(prevState => ({
      ...prevState,
      repair_notes: value
    }));
  };

  // Save report data
  const handleSave = () => {
    if (!reportData.job_ref) {
      alert("❌ Error: Job Reference is missing.");
      return;
    }

    // Prepare the data to submit
    const dataToSubmit = {
      ...reportData,
      engineer_name: reportData.engineer_name || "",
      time_spent: reportData.time_spent || "",
      repair_notes: reportData.repair_notes || "",
      status: reportData.status || "On Bench"
    };

    // The POST request will update both the engineer report and the job status
    fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/engineer-reports`, {
      method: "POST",
      headers: {
        ...getAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dataToSubmit),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then(errData => {
            throw new Error(`Failed to save report (Status: ${response.status}): ${errData.error || 'Unknown error'}`);
          });
        }
        return response.json();
      })
      .then((data) => {
        alert("✅ Engineer Report Saved!");
        
        // Log activity
        logActivity("report_update", `Updated engineer report for job #${job_ref}`);
        
        // If we have job data, update it locally to reflect the new status
        if (jobData) {
          setJobData({
            ...jobData,
            status: reportData.status
          });
        }
      })
      .catch((error) => {
        console.error("❌ Error saving report:", error);
        alert(`❌ Error saving engineer report: ${error.message}`);
      });
  };

  // Handle printing the engineer report
  const handlePrintReport = () => {
    if (!jobData || !reportData.job_ref) {
      alert("❌ Error: Missing job data or reference.");
      return;
    }

    // Log activity
    logActivity("print_report", `Printed engineer report for job #${job_ref}`);

    // Format date for display
    const formattedDate = jobData?.checked_in_date 
      ? new Date(jobData.checked_in_date).toLocaleDateString('en-GB')
      : new Date().toLocaleDateString('en-GB');
    
    // Format deposit
    const depositAmount = parseInt(jobData?.deposit_paid || 0);

    // Get current date/time for the report header
    const now = new Date();
    const headerDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;

    // Create print window
    const printWindow = window.open("", "_blank");
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Engineer's Report - Job ${reportData.job_ref}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #2d3748;
            }
            
            body {
              font-size: 11pt;
              line-height: 1.5;
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            
            .date-header {
              text-align: right;
              font-size: 10pt;
              color: #718096;
              margin-bottom: 8px;
            }
            
            .document-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 25px;
              padding-bottom: 15px;
              border-bottom: 2px solid #e2e8f0;
            }
            
            .logo-container {
              flex: 0 0 200px;
            }
            
            .logo {
              width: 100%;
              height: auto;
              max-width: 180px;
            }
            
            .report-title-container {
              flex: 1;
              text-align: right;
            }
            
            .report-title {
              font-size: 26pt;
              font-weight: 700;
              margin-bottom: 5px;
              color: #1a365d;
            }
            
            .job-ref {
              font-size: 18pt;
              font-weight: 600;
              color: #2b6cb0;
            }
            
            .content-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 25px;
            }
            
            @media (max-width: 640px) {
              .content-grid {
                grid-template-columns: 1fr;
              }
            }
            
            .panel {
              background-color: #f7fafc;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
              height: 100%;
            }
            
            .panel-bordered {
              border: 1px solid #e2e8f0;
            }
            
            .customer-name {
              font-weight: 700;
              font-size: 16pt;
              margin-bottom: 5px;
              color: #2c5282;
            }
            
            .customer-phone {
              color: #4a5568;
              margin-bottom: 10px;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 130px 1fr;
              gap: 12px;
              align-items: baseline;
            }
            
            .info-label {
              font-weight: 600;
              color: #4a5568;
            }
            
            .info-value {
              font-weight: normal;
            }
            
            .section-title {
              font-weight: 700;
              font-size: 16pt;
              margin: 25px 0 15px 0;
              padding-bottom: 8px;
              border-bottom: 2px solid #edf2f7;
              color: #2c5282;
            }
            
            .device-details {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
              gap: 15px;
              margin-bottom: 20px;
            }

            .device-label {
              font-weight: 600;
              font-size: 10pt;
              color: #4a5568;
              margin-bottom: 4px;
            }

            .work-done {
              background-color: #f7fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 20px;
              margin-top: 15px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            
            .work-done p {
              margin-bottom: 10px;
            }
            
            .work-done ul {
              margin-left: 25px;
              margin-bottom: 15px;
            }
            
            .work-done li {
              margin-bottom: 6px;
            }
            
            .meta-info {
              color: #718096;
              font-size: 10pt;
              text-align: center;
              margin-top: 35px;
              padding-top: 15px;
              border-top: 1px solid #e2e8f0;
              font-style: italic;
            }
            
            @media print {
              body {
                padding: 0;
              }
              
              .panel, .work-done {
                break-inside: avoid;
                background-color: #fff;
              }

              .document-header {
                break-after: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="date-header">${headerDate}</div>
          
          <div class="document-header">
            <div class="logo-container">
              <img src="/logo.png" alt="Newry Computer Centre" class="logo" />
            </div>
            
            <div class="report-title-container">
              <div class="report-title">Engineer's Report</div>
              <div class="job-ref">Job: ${reportData.job_ref}</div>
            </div>
          </div>

          <div class="content-grid">
            <div class="panel panel-bordered">
              <div class="customer-name">${jobData?.customer_name || 'N/A'}</div>
              <div class="customer-phone">${jobData?.contact_number || 'N/A'}</div>
              
              <div class="info-grid">
                <div class="info-label">Checked In:</div>
                <div class="info-value">${formattedDate}</div>
                
                <div class="info-label">Engineer:</div>
                <div class="info-value">${reportData.engineer_name || 'N/A'}</div>
                
                <div class="info-label">Status:</div>
                <div class="info-value">${reportData.status || 'N/A'}</div>
                
                <div class="info-label">Deposit:</div>
                <div class="info-value">£${depositAmount}</div>
                
                <div class="info-label">Time Spent:</div>
                <div class="info-value">${reportData.time_spent || 'N/A'}</div>
              </div>
            </div>
            
            <div class="panel panel-bordered">
              <div class="device-details">
                ${jobData?.manufacturer ? `
                <div>
                  <div class="device-label">Manufacturer</div>
                  <div>${jobData.manufacturer}</div>
                </div>` : ''}
                
                ${jobData?.device_type ? `
                <div>
                  <div class="device-label">Device Type</div>
                  <div>${jobData.device_type}</div>
                </div>` : ''}

                ${jobData?.serial_number ? `
                <div>
                  <div class="device-label">Serial Number</div>
                  <div>${jobData.serial_number || 'N/A'}</div>
                </div>` : ''}
                
                ${jobData?.booked_in_by ? `
                <div>
                  <div class="device-label">Booked In By</div>
                  <div>${jobData.booked_in_by}</div>
                </div>` : ''}
              </div>
              
              <div class="section-title" style="margin-top: 0; font-size: 14pt;">Job Description</div>
              <div>
                <p>${jobData?.job_details || 'No job details provided.'}</p>
                ${jobData?.additional_notes ? `<p>${jobData.additional_notes}</p>` : ''}
              </div>
            </div>
          </div>
          
          <div class="section-title">Work Done</div>
          <div class="work-done">
            ${reportData.repair_notes || '<p>No work details provided.</p>'}
          </div>
          
          <div class="meta-info">
            Report generated ${headerDate} · Newry Computer Centre
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  // If loading or error, show appropriate message
  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4">🛠️ Loading Engineer Report...</h2>
        <div className="animate-pulse bg-blue-100 p-4 rounded">
          <p>Loading data for Job Ref: {job_ref || "N/A"}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4 text-red-600">❌ Error Loading Engineer Report</h2>
        <div className="bg-red-100 p-4 rounded border border-red-400">
          <p>{error}</p>
          <p className="mt-2">Make sure you select a valid job first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">
        🛠️ Engineer Report (Job Ref: <span className="text-blue-600">{reportData.job_ref || "N/A"}</span>)
      </h2>

      {/* Device information */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-2">Device Information</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-600 text-sm">Manufacturer:</span>
            <div className="font-medium">{jobData?.manufacturer || 'N/A'}</div>
          </div>
          <div>
            <span className="text-gray-600 text-sm">Device Type:</span>
            <div className="font-medium">{jobData?.device_type || 'N/A'}</div>
          </div>
          <div>
            <span className="text-gray-600 text-sm">Serial Number:</span>
            <div className="font-medium">{jobData?.serial_number || 'N/A'}</div>
          </div>
          <div>
            <span className="text-gray-600 text-sm">Current Status:</span>
            <div className="font-medium">{jobData?.status || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          name="engineer_name"
          placeholder="Engineer Name"
          value={reportData.engineer_name}
          onChange={handleChange}
          className="p-2 border rounded w-full"
        />
        <input
          type="text"
          name="time_spent"
          placeholder="Time Spent"
          value={reportData.time_spent}
          onChange={handleChange}
          className="p-2 border rounded w-full"
        />
        <select
          name="status"
          value={reportData.status}
          onChange={handleChange}
          className="p-2 border rounded w-full col-span-2"
        >
          <option value="On Bench">On Bench</option>
          <option value="Repaired">Repaired</option>
          <option value="Unrepaired">Unrepaired</option>
          <option value="Waiting for Customer">Waiting for Customer</option>
        </select>
      </div>

      {/* Work Done Section */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Work Done:</h3>
        <div className="border rounded shadow-md">
          <ReactQuill
            theme="snow"
            value={reportData.repair_notes || ''}
            onChange={handleQuillChange}
            modules={{
              toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{'list': 'ordered'}, {'list': 'bullet'}],
                ['clean']
              ]
            }}
            formats={[
              'header',
              'bold', 'italic', 'underline', 'strike',
              'list', 'bullet'
            ]}
            style={{ height: "250px", marginBottom: "42px" }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex gap-4">
        <button 
          onClick={handleSave} 
          className="bg-blue-500 text-white px-4 py-2 rounded flex items-center hover:bg-blue-600"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save Report
        </button>
        
        <button
          onClick={handlePrintReport}
          disabled={!jobData || !reportData.job_ref}
          className={`flex items-center px-4 py-2 rounded ${
            !jobData || !reportData.job_ref
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Engineer Report
        </button>
      </div>
    </div>
  );
};

export default EngineerReport;