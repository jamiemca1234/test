// NewJob.js with serial number field fully integrated
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SMSNotificationHistory from "../components/SMSNotificationHistory";
import PrinterHelp from '../components/PrinterHelp';

// Create a simple inline error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Caught error in ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-3 bg-red-50 text-red-600 rounded">
          Something went wrong.
        </div>
      );
    }

    return this.props.children;
  }
}

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

const NewJob = () => {
  const { jobRef } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedJob = location.state?.selectedJob || null;

  const { getAuthHeader, logActivity, apiUrl, user } = useAuth();



  const smsHistoryRef = useRef(null);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // State for Job Data
  const [jobData, setJobData] = useState({
    job_ref: jobRef || "",
    customer_name: "",
    contact_number: "",
    job_details: "",
    booked_in_by: "", // Will be populated with user initials
    deposit_paid: "",
    manufacturer: "",
    device_type: "",
    serial_number: "", // Added serial number field
    additional_notes: "",
    status: "Queued",
  });

  const [isNewJob, setIsNewJob] = useState(!jobRef || jobRef === "new");

  // Fetch Job Data if Editing OR Generate New Job Ref
  useEffect(() => {
    if (selectedJob) {
      setJobData(selectedJob);
      setIsNewJob(false);
    } else if (jobRef && jobRef !== "new") {
      fetch(`https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs/${jobRef}`, {
        headers: getAuthHeader()
      })
        .then((response) => response.json())
        .then((data) => {
          // Ensure we have a default value for serial_number if it's null/undefined
          if (data.serial_number === null || data.serial_number === undefined) {
            data.serial_number = "";
          }
          setJobData(data);
          setIsNewJob(false);
        })
        .catch((error) => console.error("❌ Error loading job:", error));
    } else {
      fetch("https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs/latest", {
        headers: getAuthHeader()
      })
        .then((response) => response.json())
        .then((data) => {
          setJobData((prev) => ({
            ...prev,
            job_ref: data.latestJobRef ? data.latestJobRef + 1 : 1,
          }));
          
          // Auto-populate booked_in_by with user initials for new jobs
          if (user && user.fullName) {
            const initials = getInitialsFromName(user.fullName);
            setJobData(prev => ({
              ...prev,
              booked_in_by: initials
            }));
          }
        })
        .catch((error) => console.error("❌ Error fetching latest job ref:", error));
    }
  }, [jobRef, selectedJob, getAuthHeader, user]);

  // Auto-populate booked_in_by with user initials if it's empty
  useEffect(() => {
    if (isNewJob && !jobData.booked_in_by && user && user.fullName) {
      const initials = getInitialsFromName(user.fullName);
      setJobData(prev => ({
        ...prev,
        booked_in_by: initials
      }));
    }
  }, [isNewJob, jobData.booked_in_by, user]);

  // Handle Form Input Changes
  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === "deposit_paid") {
      value = value.replace(/[^0-9]/g, ""); // Remove all non-numeric characters
      value = value ? parseInt(value) : ""; // Parse as integer, not float
    }
    setJobData({ ...jobData, [e.target.name]: value });
  };

  // Save Job to Database
  const handleSave = () => {
    const apiUrl = `https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000/api/jobs${isNewJob ? "" : `/${jobRef}`}`;
    const methodType = isNewJob ? "POST" : "PUT";

    // Log what we're about to send for troubleshooting
    console.log("Saving job data:", jobData);

    setIsLoading(true);
    setSaveMessage(null);

    fetch(apiUrl, {
      method: methodType,
      headers: {
        ...getAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(jobData),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to save job. Check server response.");
        }
        return response.json();
      })
      .then((data) => {
        // Log activity based on whether creating or updating
        const activityType = isNewJob ? "job_create" : "job_update";
        const activityDetails = isNewJob 
          ? `Created new job #${jobData.job_ref} for ${jobData.customer_name}` 
          : `Updated job #${jobData.job_ref}`;
        
        logActivity(activityType, activityDetails);
        
        setSaveMessage({
          type: 'success',
          text: isNewJob ? "✅ Job Created Successfully!" : "✅ Job Updated Successfully!"
        });
        
        // If it's a new job, update the state to reflect it's no longer a new job
        if (isNewJob) {
          setIsNewJob(false);
          // Update URL without reloading the page - this helps with future saves
          window.history.replaceState(null, null, `/new-job/${jobData.job_ref}`);
        }
      })
      .catch((error) => {
        console.error("Error saving job:", error);
        setSaveMessage({
          type: 'error',
          text: `❌ Error: ${error.message}`
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Open Engineer Report
  const handleEngineerReport = () => {
    if (!jobData.job_ref) {
      alert("⚠️ Save the job first before adding an Engineer Report!");
      return;
    }
  
    console.log(`🟢 Navigating to Engineer Report for Job Ref: ${jobData.job_ref}`);
    navigate(`/engineer-report/${jobData.job_ref}`, { state: { job_ref: jobData.job_ref } });
  };

  // Handle printing label
  const handlePrintLabel = async () => {
    try {
      if (!jobData.job_ref) {
        setSaveMessage({
          type: 'error',
          text: "❌ Cannot print label: Missing job reference number"
        });
        return;
      }
      
      // First, let's check if Dymo is installed by trying to detect the Dymo service
      let isDymoInitialized = false;
      
      // Load the Dymo SDK script if not already loaded
      if (!window.dymo || !window.dymo.label || !window.dymo.label.framework) {
        try {
          console.log("Loading Dymo SDK script...");
          await loadDymoScript();
          console.log("Dymo SDK script loaded successfully");
        } catch (error) {
          console.error("Failed to load Dymo SDK script:", error);
          throw new Error("Could not load the Dymo printer software. Please ensure Dymo software is installed.");
        }
      }
      
      // Initialize the framework
      try {
        console.log("Initializing Dymo framework...");
        await window.dymo.label.framework.init();
        isDymoInitialized = true;
        console.log("Dymo framework initialized successfully");
      } catch (error) {
        console.error("Failed to initialize Dymo framework:", error);
        throw new Error("Could not initialize Dymo printer. Please ensure Dymo software is running.");
      }
      
      if (!isDymoInitialized) {
        throw new Error("Dymo framework initialization failed.");
      }
      
      // Check for available printers
      console.log("Checking for Dymo printers...");
      const printers = await window.dymo.label.framework.getPrinters();
      console.log("Available printers:", printers);
      
      if (!printers || printers.length === 0) {
        throw new Error("No DYMO printers found. Please connect your DYMO printer.");
      }
      
      // Find a LabelWriter printer
      const printer = printers.find(p => p.printerType === "LabelWriterPrinter");
      if (!printer) {
        throw new Error("No DYMO LabelWriter printer found.");
      }
      
      console.log("Found Dymo printer:", printer.name);
      
      // Format date
      const today = new Date();
      const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      const depositAmount = jobData.deposit_paid ? parseInt(jobData.deposit_paid) : "0";
      
      // Create a label XML template for 30253 Address labels
      const labelXml = `<?xml version="1.0" encoding="utf-8"?>
  <DieCutLabel Version="8.0" Units="twips">
    <PaperOrientation>Landscape</PaperOrientation>
    <Id>Address</Id>
    <PaperName>30253 Address</PaperName>
    <DrawCommands>
      <RoundRectangle X="0" Y="0" Width="1581" Height="5040" Rx="270" Ry="270" />
    </DrawCommands>
    <ObjectInfo>
      <TextObject>
        <Name>JobRef</Name>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
        <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <HorizontalAlignment>Left</HorizontalAlignment>
        <VerticalAlignment>Middle</VerticalAlignment>
        <TextFitMode>None</TextFitMode>
        <UseFullFontHeight>True</UseFullFontHeight>
        <Verticalized>False</Verticalized>
        <StyledText>
          <Element>
            <String>Job #${jobData.job_ref}</String>
            <Attributes>
              <Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False" />
              <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            </Attributes>
          </Element>
        </StyledText>
      </TextObject>
      <Bounds X="331" Y="150" Width="4367" Height="484" />
    </ObjectInfo>
    <ObjectInfo>
      <LineObject>
        <Name>Line</Name>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
        <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <LineWidth>15</LineWidth>
        <LineAlignment>Center</LineAlignment>
        <FillMode>None</FillMode>
      </LineObject>
      <Bounds X="331" Y="634" Width="4361" Height="15" />
    </ObjectInfo>
    <ObjectInfo>
      <TextObject>
        <Name>CustomerName</Name>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
        <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <HorizontalAlignment>Left</HorizontalAlignment>
        <VerticalAlignment>Middle</VerticalAlignment>
        <TextFitMode>None</TextFitMode>
        <UseFullFontHeight>True</UseFullFontHeight>
        <Verticalized>False</Verticalized>
        <StyledText>
          <Element>
            <String>${jobData.customer_name || 'Customer Name'}</String>
            <Attributes>
              <Font Family="Arial" Size="10" Bold="True" Italic="False" Underline="False" Strikeout="False" />
              <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            </Attributes>
          </Element>
        </StyledText>
      </TextObject>
      <Bounds X="331" Y="664" Width="4361" Height="420" />
    </ObjectInfo>
    <ObjectInfo>
      <TextObject>
        <Name>ContactNumber</Name>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
        <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <HorizontalAlignment>Left</HorizontalAlignment>
        <VerticalAlignment>Middle</VerticalAlignment>
        <TextFitMode>None</TextFitMode>
        <UseFullFontHeight>True</UseFullFontHeight>
        <Verticalized>False</Verticalized>
        <StyledText>
          <Element>
            <String>${jobData.contact_number || 'Contact Number'}</String>
            <Attributes>
              <Font Family="Arial" Size="9" Bold="False" Italic="False" Underline="False" Strikeout="False" />
              <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            </Attributes>
          </Element>
        </StyledText>
      </TextObject>
      <Bounds X="331" Y="1067" Width="4361" Height="390" />
    </ObjectInfo>
    <ObjectInfo>
      <TextObject>
        <Name>SerialNumber</Name>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
        <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <HorizontalAlignment>Left</HorizontalAlignment>
        <VerticalAlignment>Middle</VerticalAlignment>
        <TextFitMode>None</TextFitMode>
        <UseFullFontHeight>True</UseFullFontHeight>
        <Verticalized>False</Verticalized>
        <StyledText>
          <Element>
            <String>S/N: ${jobData.serial_number || 'N/A'}</String>
            <Attributes>
              <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
              <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            </Attributes>
          </Element>
        </StyledText>
      </TextObject>
      <Bounds X="331" Y="1220" Width="4361" Height="200" />
    </ObjectInfo>
    <ObjectInfo>
      <LineObject>
        <Name>Line2</Name>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
        <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <LineWidth>15</LineWidth>
        <LineAlignment>Center</LineAlignment>
        <FillMode>None</FillMode>
      </LineObject>
      <Bounds X="331" Y="1433" Width="4361" Height="15" />
    </ObjectInfo>
    <ObjectInfo>
      <TextObject>
        <Name>DateInfo</Name>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
        <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <HorizontalAlignment>Left</HorizontalAlignment>
        <VerticalAlignment>Middle</VerticalAlignment>
        <TextFitMode>None</TextFitMode>
        <UseFullFontHeight>True</UseFullFontHeight>
        <Verticalized>False</Verticalized>
        <StyledText>
          <Element>
            <String>Date: ${formattedDate}</String>
            <Attributes>
              <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
              <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            </Attributes>
          </Element>
        </StyledText>
      </TextObject>
      <Bounds X="331" Y="1463" Width="2173" Height="270" />
    </ObjectInfo>
    <ObjectInfo>
      <TextObject>
        <Name>DepositInfo</Name>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
        <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <HorizontalAlignment>Right</HorizontalAlignment>
        <VerticalAlignment>Middle</VerticalAlignment>
        <TextFitMode>None</TextFitMode>
        <UseFullFontHeight>True</UseFullFontHeight>
        <Verticalized>False</Verticalized>
        <StyledText>
          <Element>
            <String>Deposit: £${depositAmount}</String>
            <Attributes>
              <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
              <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            </Attributes>
          </Element>
        </StyledText>
      </TextObject>
      <Bounds X="2504" Y="1463" Width="2188" Height="270" />
    </ObjectInfo>
  </DieCutLabel>`;
  
      console.log("Creating label...");
      // Open the label
      const label = window.dymo.label.framework.openLabelXml(labelXml);
      
      console.log("Printing label to", printer.name);
      // Print the label
      label.print(printer.name);
      
      // Log activity
      logActivity("print_label", `Printed label for job #${jobData.job_ref}`);
      
      setSaveMessage({
        type: 'success',
        text: `✅ Label printed successfully to ${printer.name}`
      });
      
    } catch (error) {
      console.error("❌ Error printing job label:", error);
      setSaveMessage({
        type: 'error',
        text: `❌ Error printing label: ${error.message}`
      });
    }
  };
  
  // Helper function to load the Dymo SDK
  const loadDymoScript = () => {
    return new Promise((resolve, reject) => {
      // Check if script is already in progress of loading
      if (document.querySelector('script[src*="DYMO.Label.Framework"]')) {
        console.log("Dymo script is already loading");
        // Give a bit of time for it to finish loading if in progress
        setTimeout(resolve, 1000);
        return;
      }
      
      const script = document.createElement('script');
      script.src = "https://labelwriter.com/software/dls/sdk/js/DYMO.Label.Framework.latest.js";
      script.async = true;
      
      script.onload = () => {
        console.log("Dymo script loaded successfully!");
        resolve();
      };
      
      script.onerror = () => {
        console.error("Failed to load Dymo script");
        reject(new Error("Failed to load Dymo SDK script."));
      };
      
      document.body.appendChild(script);
    });
  };

// Fixed handleSendSMS function for NewJob.js
  // Fixed Send SMS function
  const handleSendSMS = () => {
    if (!jobData.contact_number || !jobData.job_ref) {
      setSaveMessage({
        type: 'error',
        text: "❌ Cannot send SMS: Missing contact number or job reference"
      });
      return;
    }
    
    // Use the apiUrl from context if available, otherwise use the direct URL
    const baseUrl = apiUrl || 'https://ncc-workshop-01.ad.newrycomputercentre.co.uk:9000';
    const apiEndpoint = `${baseUrl}/api/send-sms`;
    
    // Create a personalized message
    const message = `Hi ${jobData.customer_name}, your ${jobData.device_type || 'device'} is ready for collection from Newry Computer Centre. Job #${jobData.job_ref}`;

    // Set loading state
    setSendingSMS(true);
    setSaveMessage(null);

    console.log("Sending SMS to:", jobData.contact_number);
    console.log("Message:", message);
    console.log("API Endpoint:", apiEndpoint);
    console.log("Auth headers:", getAuthHeader()); // Debug line to check the token

    fetch(apiEndpoint, {
      method: "POST",
      headers: {
        ...getAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: jobData.contact_number,
        message: message,
        job_ref: jobData.job_ref
      }),
    })
      .then((response) => {
        if (!response.ok) {
          // Get the error message from the response
          return response.json().then(errData => {
            throw new Error(errData.error || `Server error: ${response.status}`);
          });
        }
        return response.json();
      })
      .then((data) => {
        setSendingSMS(false);
        
        if (data.success) {
          setSaveMessage({
            type: 'success',
            text: "✅ SMS sent successfully!"
          });
          
          // Log activity
          logActivity("send_sms", `Sent SMS to ${jobData.contact_number} for job #${jobData.job_ref}`);
          
          // Refresh SMS history - safely with try/catch
          try {
            if (smsHistoryRef.current && typeof smsHistoryRef.current.refresh === 'function') {
              smsHistoryRef.current.refresh();
            }
          } catch (error) {
            console.error("Failed to refresh SMS history:", error);
          }
        } else {
          console.error("SMS sending failed:", data);
          setSaveMessage({
            type: 'error',
            text: `❌ Error sending SMS: ${data.error || 'Unknown error'}${data.details ? ` - ${data.details}` : ''}`
          });
        }
      })
      .catch((error) => {
        console.error("SMS Error:", error);
        setSendingSMS(false);
        setSaveMessage({
          type: 'error',
          text: `❌ Error sending SMS: ${error.message}`
        });
      });
  };

  // Safe render for SMS History component
  const renderSMSHistory = () => {
    if (!jobData.job_ref) {
      return null;
    }

    try {
      return (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-3">SMS Notifications</h3>
          <ErrorBoundary fallback={
            <div className="text-sm text-red-500 py-3">
              Error loading SMS notifications. Please refresh the page to try again.
            </div>
          }>
            {/* Simple fallback while loading */}
            <div className="relative">
              <SMSNotificationHistory 
                jobRef={jobData.job_ref} 
                ref={smsHistoryRef}
              />
            </div>
          </ErrorBoundary>
        </div>
      );
    } catch (error) {
      console.error("Error rendering SMS history section:", error);
      return (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-3">SMS Notifications</h3>
          <div className="text-sm text-gray-500 italic py-3">
            Unable to load SMS notifications.
          </div>
        </div>
      );
    }
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">{isNewJob ? "New Job" : "Edit Job"}</h2>
        
        {jobData.job_ref && (
          <div className="text-xl font-semibold text-blue-600">
            Job #{jobData.job_ref}
          </div>
        )}
      </div>
      
      {/* Save message */}
      {saveMessage && (
        <div className={`mb-4 p-3 rounded ${
          saveMessage.type === 'error' 
            ? 'bg-red-100 text-red-700 border border-red-200' 
            : 'bg-green-100 text-green-700 border border-green-200'
        }`}>
          {saveMessage.text}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        {/* First row - Customer Name and Contact Number */}
        <div className="col-span-1">
          <input 
            type="text" 
            name="customer_name" 
            placeholder="Customer Name" 
            value={jobData.customer_name} 
            onChange={handleChange} 
            className="p-2 border rounded w-full" 
          />
        </div>
        <div className="col-span-1">
          <input 
            type="text" 
            name="contact_number" 
            placeholder="Contact Number" 
            value={jobData.contact_number} 
            onChange={handleChange} 
            className="p-2 border rounded w-full" 
          />
        </div>
        
        {/* Job Details - Full width */}
        <div className="col-span-2">
          <textarea 
            name="job_details" 
            placeholder="Job Details" 
            value={jobData.job_details} 
            onChange={handleChange} 
            className="p-2 border rounded w-full resize-y" 
            rows="4"
          />
        </div>
        
        {/* Next row - Booked In By and Deposit Paid */}
        <div className="col-span-1">
          <input 
            type="text" 
            name="booked_in_by" 
            placeholder="Booked In By" 
            value={jobData.booked_in_by} 
            onChange={handleChange} 
            className="p-2 border rounded w-full" 
          />
        </div>
        <div className="col-span-1">
          <input 
            type="text" 
            name="deposit_paid" 
            placeholder="Deposit Paid (£)" 
            value={jobData.deposit_paid} 
            onChange={handleChange} 
            className="p-2 border rounded w-full" 
          />
        </div>
        
        {/* Next row - Manufacturer and Device Type */}
        <div className="col-span-1">
          <select
            name="manufacturer"
            value={jobData.manufacturer}
            onChange={handleChange}
            className="p-2 border rounded w-full"
          >
            <option value="">Select Manufacturer</option>
            <option value="Apple">Apple</option>
            <option value="Lenovo">Lenovo</option>
            <option value="HP">HP</option>
            <option value="Dell">Dell</option>
            <option value="Acer">Acer</option>
            <option value="Asus">Asus</option>
            <option value="Microsoft">Microsoft</option>
            <option value="Samsung">Samsung</option>
            <option value="Sony">Sony</option>
            <option value="Toshiba">Toshiba</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="col-span-1">
          <select
            name="device_type"
            value={jobData.device_type}
            onChange={handleChange}
            className="p-2 border rounded w-full"
          >
            <option value="">Select Device Type</option>
            <option value="Laptop">Laptop</option>
            <option value="Desktop PC">Desktop PC</option>
            <option value="Tablet">Tablet</option>
            <option value="Smartphone">Smartphone</option>
            <option value="All-in-One PC">All-in-One PC</option>
            <option value="MacBook">MacBook</option>
            <option value="iMac">iMac</option>
            <option value="iPad">iPad</option>
            <option value="iPhone">iPhone</option>
            <option value="Gaming Console">Gaming Console</option>
            <option value="Printer">Printer</option>
            <option value="Monitor">Monitor</option>
            <option value="Network Device">Network Device (Router/Switch)</option>
            <option value="External Drive">External Drive</option>
            <option value="Smart Watch">Smart Watch</option>
            <option value="Projector">Projector</option>
            <option value="Smart TV">Smart TV</option>
            <option value="Server">Server</option>
            <option value="Other">Other</option>
          </select>
        </div>
        
        {/* Serial Number field - full width */}
        <div className="col-span-2">
          <input 
            type="text" 
            name="serial_number" 
            placeholder="Device Serial Number (if available)" 
            value={jobData.serial_number || ""} 
            onChange={handleChange} 
            className="p-2 border rounded w-full" 
          />
        </div>
        
        {/* Additional Notes - Full width */}
        <div className="col-span-2">
          <textarea 
            name="additional_notes" 
            placeholder="Additional Notes" 
            value={jobData.additional_notes} 
            onChange={handleChange} 
            className="p-2 border rounded w-full resize-y" 
            rows="3"
          />
        </div>
        
        {/* Status Dropdown - Full width */}
        <div className="col-span-2">
          <select
            name="status"
            value={jobData.status || "Queued"}
            onChange={handleChange}
            className="p-2 border rounded w-full"
          >
            <option value="Queued">Queued</option>
            <option value="On Bench">On Bench</option>
            <option value="Waiting for Customer">Waiting for Customer</option>
            <option value="Repaired">Repaired</option>
            <option value="Unrepaired">Unrepaired</option>
          </select>
        </div>
      </div>
      
      <div className="mt-6 flex flex-wrap gap-2">
        <button 
          onClick={handleSave}
          disabled={isLoading}
          className={`bg-blue-500 text-white px-4 py-2 rounded flex items-center ${
            isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-600'
          }`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save
            </>
          )}
        </button>
        
        <button 
          onClick={handleEngineerReport}
          disabled={!jobData.job_ref || isNewJob}
          className={`bg-green-500 text-white px-4 py-2 rounded flex items-center ${
            !jobData.job_ref || isNewJob ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'
          }`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Engineer Report
        </button>
        
        <button 
          onClick={handlePrintLabel}
          disabled={!jobData.job_ref || isNewJob}
          className={`bg-gray-700 text-white px-4 py-2 rounded flex items-center ${
            !jobData.job_ref || isNewJob ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'
          }`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Label
        </button>
        
        <button 
          onClick={handleSendSMS}
          disabled={sendingSMS || !jobData.contact_number || !jobData.job_ref || isNewJob}
          className={`bg-yellow-500 text-white px-4 py-2 rounded flex items-center ${
            sendingSMS || !jobData.contact_number || !jobData.job_ref || isNewJob ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-600'
          }`}
        >
          {sendingSMS ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send SMS
            </>
          )}
        </button>
      </div>
      
      {/* Printer Help section */}
      <div className="mt-6">
        <PrinterHelp />
      </div>

      {/* SMS History Section */}
      {renderSMSHistory()}
    </div>
  );
};

export default NewJob