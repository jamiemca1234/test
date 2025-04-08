// src/utils/EngineerReportService.js

/**
 * Service for generating and printing Engineer Reports
 */
class EngineerReportService {
    /**
     * Generate a printable HTML representation of an Engineer Report
     */
    generateReportHtml(jobData, reportData) {
      if (!jobData || !reportData) {
        throw new Error('Missing job or report data');
      }
  
      // Format date for display
      const formattedDate = jobData.checked_in_date 
        ? new Date(jobData.checked_in_date).toLocaleDateString('en-GB')
        : new Date().toLocaleDateString('en-GB');
      
      // Format deposit for display
      const formattedDeposit = parseFloat(jobData.deposit_paid || 0).toFixed(2);
  
      // Parse repair notes from the rich text editor
      let parsedRepairNotes = reportData.repair_notes || '';
      // If repair notes is HTML, extract the text content
      if (parsedRepairNotes.includes('<p>') || parsedRepairNotes.includes('<div>')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = parsedRepairNotes;
        
        // Convert the HTML to bullet points
        const bulletPoints = [];
        const paragraphs = tempDiv.querySelectorAll('p');
        paragraphs.forEach(p => {
          if (p.textContent.trim()) {
            bulletPoints.push(p.textContent.trim());
          }
        });
        
        parsedRepairNotes = bulletPoints.map(point => `• ${point}`).join('\n');
      }
  
      // Parse parts from notes if they exist
      const parts = this.extractPartsFromNotes(parsedRepairNotes);
  
      // CSS for the report
      const css = `
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
        }
        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 15mm;
          margin: 0 auto;
          background: white;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #ddd;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .logo-container {
          width: 200px;
        }
        .logo {
          width: 100%;
          height: auto;
        }
        .report-title {
          border: 1px solid #000;
          padding: 10px;
          margin-left: 20px;
        }
        .job-ref {
          font-size: 24px;
          font-weight: bold;
          margin-top: 5px;
        }
        .customer-info {
          border: 1px solid #000;
          padding: 10px;
          margin-bottom: 20px;
        }
        .job-info {
          border: 1px solid #000;
          padding: 10px;
          margin-bottom: 20px;
        }
        .job-details {
          margin-bottom: 20px;
        }
        .section-title {
          font-weight: bold;
          margin-bottom: 5px;
          border-bottom: 1px solid #ccc;
        }
        .work-done {
          margin-bottom: 20px;
        }
        .parts-list {
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 5px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            min-height: auto;
            padding: 0;
            margin: 0;
            box-shadow: none;
          }
          .no-print {
            display: none;
          }
        }
      `;
  
      // HTML for the report
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Engineer's Report - Job ${jobData.job_ref}</title>
          <style>${css}</style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="logo-container">
                <img src="/logo.png" alt="Company Logo" class="logo" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAKESURBVHhe7dUxDYRAFAXRhZqFjkhONCHCkBCBgYKEAmDgMYf5+oTJQ2u9573fYdj3PY0xvrMsy7H3bhlmrfV5XVerrHNO27bdZ3wfZLtP9n3/zj4Pst0n27YPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/IYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghvpHH8UzXdfUhlmVZy1rrPuP7INt9UhL1IZ7nqfM8lWW7TyqheYjrumrjcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP5CCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIgxDsXuTgV6hXYLwAAAABJRU5ErkJggg=='" />
              </div>
              <div class="report-title">
                <h1>Engineer's Report</h1>
                <div class="job-ref">Job: ${jobData.job_ref}</div>
              </div>
            </div>
  
            <div class="customer-info">
              <strong>${jobData.customer_name || ''}</strong><br>
              ${jobData.contact_number || ''}
            </div>
  
            <div class="job-info">
              <table>
                <tr>
                  <td><strong>Checked In:</strong></td>
                  <td>${formattedDate}</td>
                </tr>
                <tr>
                  <td><strong>Engineer:</strong></td>
                  <td>${reportData.engineer_name || ''}</td>
                </tr>
                <tr>
                  <td><strong>Status:</strong></td>
                  <td>${reportData.status || ''}</td>
                </tr>
                <tr>
                  <td><strong>Deposit:</strong></td>
                  <td>${formattedDeposit}</td>
                </tr>
              </table>
            </div>
  
            <div class="job-details">
              <div class="section-title">Job Description:</div>
              <p>${jobData.job_details || ''}</p>
              <p>${jobData.additional_notes || ''}</p>
            </div>
  
            <div class="work-done">
              <div class="section-title">Work Done:</div>
              <p style="white-space: pre-line">${this.formatWorkDone(parsedRepairNotes)}</p>
            </div>
  
            ${parts.length > 0 ? `
            <div class="parts-list">
              <div class="section-title">Parts:</div>
              <table>
                ${parts.map(part => `
                  <tr>
                    <td>${part.name}</td>
                    <td style="text-align: right">${part.price}</td>
                  </tr>
                `).join('')}
              </table>
            </div>
            ` : ''}
          </div>
        </body>
        </html>
      `;
  
      return html;
    }
  
    /**
     * Extract parts information from repair notes if available
     */
    extractPartsFromNotes(notes) {
      const parts = [];
      const lines = notes.split(/\n|\n/);
      
      // Look for parts section
      let inPartsSection = false;
      
      for (const line of lines) {
        // Check if this line starts a parts section
        if (line.toLowerCase().includes('parts:') || line.toLowerCase().includes('parts list:')) {
          inPartsSection = true;
          continue;
        }
        
        if (inPartsSection) {
          // Try to match part entries with price
          const partMatch = line.match(/^[•\-*]?\s*(.+?)\s+(\d+\.\d+|\d+)$/);
          if (partMatch) {
            parts.push({
              name: partMatch[1].trim(),
              price: partMatch[2].trim()
            });
          }
        }
      }
      
      return parts;
    }
  
    /**
     * Format work done text with bullet points
     */
    formatWorkDone(text) {
      if (!text) return '';
      
      // If the text already has bullet points, return as is
      if (text.includes('•')) return text;
      
      // Otherwise add bullet points to each line
      return text.split(/\n|\n/)
        .filter(line => line.trim())
        .map(line => `• ${line.trim()}`)
        .join('\n');
    }
  
    /**
     * Print the engineer report
     */
    printEngineerReport(jobData, reportData) {
      try {
        // Generate report HTML
        const reportHtml = this.generateReportHtml(jobData, reportData);
        
        // Open new window with the report
        const printWindow = window.open('', '_blank');
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        
        // Print after images load
        printWindow.onload = function() {
          printWindow.print();
          printWindow.onafterprint = function() {
            printWindow.close();
          };
        };
        
        return { success: true };
      } catch (error) {
        console.error('Error printing engineer report:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to print report' 
        };
      }
    }
  }
  
  const engineerReportService = new EngineerReportService();
  export default engineerReportService;