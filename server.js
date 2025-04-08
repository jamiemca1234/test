// TEMPORARY FIX - REMOVE FOR PRODUCTION
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { Vonage } = require('@vonage/server-sdk');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const https = require('https');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 9000;
const HOST = 'ncc-workshop-01.ad.newrycomputercentre.co.uk';

// Secret key for JWT - consider moving this to .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// ✅ Middleware
app.use(express.json());
app.use(cors({
  origin: ['https://ncc-workshop-01.ad.newrycomputercentre.co.uk:3000'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ===== DATABASE CONNECTION POOL (PREVENTS TIMEOUTS) =====
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'ncc-workshop-01.ad.newrycomputercentre.co.uk',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Password123!',
  database: process.env.DB_NAME || 'it_repair_system',
  port: process.env.DB_PORT || 3306,
  connectionLimit: 10,             // Maximum number of connections in the pool
  acquireTimeout: 60000,           // Time to wait for a connection (60 seconds)
  connectTimeout: 60000,           // Time to establish a connection (60 seconds)
  waitForConnections: true,        // Queue queries when no connections available
  queueLimit: 0,                   // Unlimited queueing
  enableKeepAlive: true,           // Enable TCP keep-alive
  keepAliveInitialDelay: 10000,    // Initial delay before sending keep-alive probe
  idleTimeout: 60000,              // Time a connection can be idle before being recycled
  maxIdle: 10,                     // Maximum number of idle connections to keep
  debug: process.env.NODE_ENV === 'development', // Enable debugging when in development
  namedPlaceholders: true,         // More efficient queries
  resetAfterUse: true,             // Reset connections after use
  dateStrings: true,               // Handle dates consistently
  multipleStatements: false        // Security best practice
});

// Register connection event handlers
pool.on('connection', (connection) => {
  console.log('✅ New MySQL connection established');
  
  // Set session variables for better timeouts at the connection level
  connection.query(`
      SET SESSION wait_timeout = 86400;
      SET SESSION interactive_timeout = 86400;
      SET SESSION net_read_timeout = 30;
      SET SESSION net_write_timeout = 60;
  `, (err) => {
      if (err) {
          console.error('❌ Error setting session timeouts:', err.message);
      } else {
          console.log('✅ Connection timeouts extended successfully');
      }
  });
});

pool.on('error', (err) => {
  console.error('❌ MySQL pool error:', err.message);
  
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('🔄 Database connection was lost. Attempting to reconnect...');
  }
});

// ✅ Verify pool connection and health
const checkPoolConnection = () => {
  pool.getConnection((err, connection) => {
      if (err) {
          console.error('❌ Database connection failed:', err.message);
          // But don't exit the application - let it retry
          if (err.code === 'PROTOCOL_CONNECTION_LOST') {
              console.error('Database connection was closed. Will reconnect automatically.');
          }
          if (err.code === 'ER_CON_COUNT_ERROR') {
              console.error('Database has too many connections.');
          }
          if (err.code === 'ECONNREFUSED') {
              console.error('Database connection was refused. Will retry in 10 seconds...');
              // Try again in 10 seconds
              setTimeout(checkPoolConnection, 10000);
          }
          return;
      }
      console.log('✅ Connected to MySQL Database:', process.env.DB_NAME || 'it_repair_system');
      connection.release(); // Important: release connection when done
  });
};

// Initial connection check
checkPoolConnection();

// More robust ping mechanism with reconnection logic
let pingInterval;
const startPingInterval = () => {
  // Clear any existing interval first
  if (pingInterval) clearInterval(pingInterval);
  
  pingInterval = setInterval(() => {
    // Use a Promise to handle the query properly
    const checkConnection = new Promise((resolve, reject) => {
      pool.query('SELECT 1 AS ping', (err, results) => {
        if (err) {
          console.error('❌ Database ping failed:', err.message);
          reject(err);
        } else if (results && results[0] && results[0].ping === 1) {
          // Only log ping if debugging is enabled
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Database ping successful');
          }
          resolve(true);
        } else {
          reject(new Error('Invalid ping response'));
        }
      });
    });
    
    // Handle the ping result with proper error recovery
    checkConnection.catch(err => {
      console.error('Connection error during ping:', err.message);
      
      // Force pool reconnection by getting a new connection
      pool.getConnection((connErr, connection) => {
        if (connErr) {
          console.error('❌ Failed to reconnect to database:', connErr.message);
        } else {
          console.log('✅ Database reconnection successful');
          // Important: release the connection after testing
          connection.release();
        }
      });
    });
  }, 10000); // Ping every 10 seconds for more reliability (reduced from 30)
};

// Start pinging immediately
startPingInterval();

// Add a health check endpoint
app.get('/api/health', (req, res) => {
  pool.query('SELECT 1 AS health', (err, results) => {
      if (err) {
          return res.status(500).json({ 
              status: 'error', 
              message: 'Database connection failed',
              error: err.message 
          });
      }
      res.json({ 
          status: 'ok', 
          message: 'Database connection is healthy',
          timestamp: new Date().toISOString()
      });
  });
});

// Ensure proper cleanup in shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  clearInterval(pingInterval);
  gracefulShutdown();
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  clearInterval(pingInterval);
  gracefulShutdown();
});

// Set up Vonage for SMS
const vonage = new Vonage({
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET
});

// ===== AUTHENTICATION MIDDLEWARE =====
// Middleware to verify JWT token - UPDATED VERSION
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    // Check if token is expired
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        code: 'TOKEN_EXPIRED'
      });
    }
    res.status(400).json({ error: 'Invalid token' });
  }
};

// ===== ERROR HANDLING MIDDLEWARE =====
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.stack);
    res.status(500).json({
        error: 'Server error occurred',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// ===== AUTHENTICATION ROUTES =====
// User Registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password, fullName, role = 'staff' } = req.body;
    
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Check if user already exists
    pool.query('SELECT * FROM users WHERE username = ?', [username], async (err, result) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create new user
      const newUser = {
        username,
        password: hashedPassword,
        full_name: fullName,
        role,
        created_at: new Date()
      };
      
      pool.query('INSERT INTO users SET ?', newUser, (err, result) => {
        if (err) {
          console.error('❌ Error creating user:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        res.status(201).json({ 
          message: 'User created successfully',
          userId: result.insertId
        });
      });
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User Login
app.post('/api/users/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if user exists
    pool.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      const user = results[0];
      
      // Compare password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Create and assign token - UPDATED TO 30 DAYS
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          fullName: user.full_name,
          role: user.role 
        }, 
        JWT_SECRET,
        { expiresIn: '365d' } // Changed from '8h' to '30d'
      );
      
      // Log the login
      pool.query(
        'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
        [user.id, 'login', 'User logged in'],
        (err) => {
          if (err) {
            console.error('❌ Error logging activity:', err);
          }
        }
      );
      
      // Return user info and token
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role
        }
      });
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW ENDPOINT: Token Refresh
app.post('/api/users/refresh-token', verifyToken, (req, res) => {
  try {
    // The user is already verified by the verifyToken middleware
    // Generate a new token with a reset expiration time
    const token = jwt.sign(
      { 
        id: req.user.id, 
        username: req.user.username,
        fullName: req.user.fullName,
        role: req.user.role 
      }, 
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Return the new token
    res.json({ token });
    
    // Log the token refresh
    console.log(`✅ Token refreshed for user: ${req.user.username}`);
    
  } catch (error) {
    console.error('❌ Refresh token error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Current User
app.get('/api/users/me', verifyToken, (req, res) => {
  pool.query('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(results[0]);
  });
});

// Get All Users (Admin only)
app.get('/api/users', verifyToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  pool.query('SELECT id, username, full_name, role, created_at FROM users', (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(results);
  });
});

// Update User (Self or Admin)
app.put('/api/users/:id', verifyToken, async (req, res) => {
  const userId = parseInt(req.params.id);
  
  // Users can only update their own data unless they're admin
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const { fullName, password, role } = req.body;
  const updates = {};
  
  if (fullName) updates.full_name = fullName;
  
  // Only admin can change roles
  if (role && req.user.role === 'admin') {
    updates.role = role;
  }
  
  // Update password if provided
  if (password) {
    const salt = await bcrypt.genSalt(10);
    updates.password = await bcrypt.hash(password, salt);
  }
  
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No update data provided' });
  }
  
  pool.query('UPDATE users SET ? WHERE id = ?', [updates, userId], (err, result) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User updated successfully' });
  });
});

// Activity Logging
app.post('/api/activity', verifyToken, (req, res) => {
  const { activityType, details } = req.body;
  
  pool.query(
    'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
    [req.user.id, activityType, details],
    (err, result) => {
      if (err) {
        console.error('❌ Error logging activity:', err);
        return res.status(500).json({ error: 'Failed to log activity' });
      }
      
      res.status(201).json({ message: 'Activity logged' });
    }
  );
});

// Get user activity logs (admin gets all, users get only their own)
app.get('/api/activity', verifyToken, (req, res) => {
  let query = 'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100';
  let params = [req.user.id];
  
  // Admins can see all logs or filter by user
  if (req.user.role === 'admin') {
    if (req.query.userId) {
      params = [req.query.userId];
    } else {
      query = 'SELECT al.*, u.username, u.full_name FROM activity_logs al JOIN users u ON al.user_id = u.id ORDER BY al.timestamp DESC LIMIT 100';
      params = [];
    }
  }
  
  pool.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(results);
  });
});

// ===== API ROUTES FOR WORKSHOP APP =====

// Updated SMS sending endpoint for server.js

// ✅ API Route: Send SMS with improved error handling and debugging
app.post('/api/send-sms', verifyToken, async (req, res) => {
  const { to, message, job_ref } = req.body;

  console.log("📧 SMS Request received:", { to, job_ref });

  if (!to || !message || !job_ref) {
      console.error("❌ Missing SMS parameters:", { to, message, job_ref });
      return res.status(400).json({ error: "❌ Missing recipient number, message, or job reference" });
  }

  try {
      // Format phone number if needed
      let formattedNumber = to;
      if (!to.startsWith('+')) {
          if (to.startsWith('0')) {
              formattedNumber = '+44' + to.substring(1).replace(/\s+|-/g, '');
          }
      }
      
      console.log("📧 Sending SMS to:", formattedNumber);

      // Make sure Vonage API key and secret are set
      if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) {
          console.error("❌ Vonage API credentials missing!");
          return res.status(500).json({ 
              success: false,
              error: "SMS service configuration error", 
              details: "Vonage API credentials not configured"
          });
      }

      // Send SMS via Vonage
      const response = await vonage.sms.send({
          to: formattedNumber,
          from: "NCC",
          text: message
      });

      console.log("📧 Vonage SMS Response:", JSON.stringify(response));

      // Determine status
      const status = response.messages && response.messages[0].status === '0' 
          ? 'sent' 
          : 'failed';
      
      // If failed, get the error message
      let errorMessage = null;
      if (status === 'failed' && response.messages && response.messages[0]) {
          errorMessage = response.messages[0]['error-text'] || 'Unknown error';
          console.error(`❌ SMS sending failed: ${errorMessage}`);
      }
      
      // Record the SMS notification in the database
      const smsData = {
          job_ref,
          sent_by: req.user.username,
          recipient: to,
          message,
          status
      };
      
      // Insert into database with better error handling
      pool.query(
          'INSERT INTO sms_notifications SET ?',
          smsData,
          (err, result) => {
              if (err) {
                  console.error('❌ Error recording SMS notification:', err);
                  
                  // Continue despite database error
                  if (status === 'sent') {
                    return res.json({ 
                        success: true, 
                        message: "✅ SMS sent successfully (but failed to record in database)",
                        messageId: response.messages[0].message_id,
                        notification: {
                            ...smsData,
                            id: null,
                            sent_at: new Date().toISOString()
                        }
                    });
                  } else {
                    return res.status(400).json({ 
                        success: false,
                        error: `Failed to send SMS: ${errorMessage || 'Unknown error'}`,
                        details: "Also failed to record in database"
                    });
                  }
              }
              
              if (status === 'sent') {
                  // Log activity
                  const activityDetails = `SMS sent to ${to} for job #${job_ref}`;
                  
                  pool.query(
                      'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
                      [req.user.id, 'send_sms', activityDetails],
                      (err) => {
                          if (err) {
                              console.error('❌ Error logging activity:', err);
                          }
                      }
                  );

                  console.log("✅ SMS Sent and recorded successfully:", response.messages[0].message_id);
                  res.json({ 
                      success: true, 
                      message: "✅ SMS sent successfully",
                      messageId: response.messages[0].message_id,
                      notification: {
                          ...smsData,
                          id: result.insertId,
                          sent_at: new Date().toISOString()
                      }
                  });
              } else {
                  // Handle error
                  const errorCode = response.messages ? response.messages[0].status : 'unknown';
                  console.error(`❌ SMS Error: ${errorCode} - ${errorMessage || 'Unknown error'}`);
                  res.status(400).json({ 
                      success: false,
                      error: `Failed to send SMS: ${errorMessage || 'Unknown error'}`,
                      code: errorCode
                  });
              }
          }
      );
  } catch (error) {
      console.error("❌ SMS Error:", error);
      res.status(500).json({ 
          success: false,
          error: "❌ Failed to send SMS", 
          details: error.message
      });
  }
});

// Get SMS history for a job
app.get('/api/sms-notifications/:job_ref', verifyToken, (req, res) => {
  const jobRef = req.params.job_ref;
  
  if (!jobRef || isNaN(parseInt(jobRef))) {
    return res.status(400).json({ error: "Invalid job reference" });
  }
  
  pool.query(
    `SELECT sn.*, u.full_name 
     FROM sms_notifications sn
     LEFT JOIN users u ON sn.sent_by = u.username
     WHERE sn.job_ref = ?
     ORDER BY sn.sent_at DESC`,
    [jobRef],
    (err, results) => {
      if (err) {
        console.error('❌ Error fetching SMS history:', err);
        return res.status(500).json({ error: "Database error" });
      }
      
      res.json(results);
    }
  );
});

// Get SMS counts for multiple jobs
app.post('/api/sms-counts', verifyToken, (req, res) => {
  const { jobRefs } = req.body;
  
  if (!Array.isArray(jobRefs) || jobRefs.length === 0) {
    return res.status(400).json({ error: "Invalid job references" });
  }
  
  // Create placeholders for SQL query
  const placeholders = jobRefs.map(() => '?').join(',');
  
  pool.query(
    `SELECT job_ref, COUNT(*) as count
     FROM sms_notifications
     WHERE job_ref IN (${placeholders})
     AND status = 'sent'
     GROUP BY job_ref`,
    jobRefs,
    (err, results) => {
      if (err) {
        console.error('❌ Error fetching SMS counts:', err);
        return res.status(500).json({ error: "Database error" });
      }
      
      // Convert results to an object with job_ref as keys
      const countsObject = {};
      results.forEach(row => {
        countsObject[row.job_ref] = row.count;
      });
      
      res.json(countsObject);
    }
  );
});

// ✅ Get All Jobs
app.get('/api/jobs', verifyToken, (req, res) => {
    const sql = 'SELECT * FROM jobs ORDER BY checked_in_date DESC';
    
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching jobs:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json(results);
    });
});

// ✅ Get Latest Job Ref
app.get('/api/jobs/latest', verifyToken, (req, res) => {
    const sql = 'SELECT MAX(job_ref) AS latestJobRef FROM jobs';
    
    pool.query(sql, (err, result) => {
        if (err) {
            console.error('❌ Error fetching latest job ref:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json({ latestJobRef: result[0].latestJobRef || 0 });
    });
});

// ✅ Add New Job
app.post('/api/jobs', verifyToken, (req, res) => {
    console.log("🟢 Received Job Data:", req.body);

    let { customer_name, contact_number, job_details, booked_in_by, deposit_paid, manufacturer, device_type, serial_number, additional_notes, status } = req.body;

    if (!customer_name || !contact_number) {
        console.error("❌ ERROR: Missing required fields.");
        return res.status(400).json({ error: "Customer name & contact number are required!" });
    }

    // ✅ Fix deposit_paid issue (convert it to an integer)
    deposit_paid = deposit_paid.toString().replace(/[£,]/g, ""); // Remove £ or any commas
    const depositAmount = parseInt(deposit_paid); // Convert to integer

    if (isNaN(depositAmount)) {
        return res.status(400).json({ error: "❌ Invalid deposit amount format!" });
    }

    const sqlInsert = `INSERT INTO jobs (customer_name, contact_number, job_details, booked_in_by, deposit_paid, manufacturer, device_type, serial_number, additional_notes, status, created_by) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                  pool.query(sqlInsert, [customer_name, contact_number, job_details, booked_in_by, depositAmount, manufacturer, device_type, serial_number, additional_notes, status, req.user.id], (err, result) => {
        if (err) {
            console.error('❌ Database insert error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        // Log activity
        pool.query(
            'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
            [req.user.id, 'job_create', `Created job #${result.insertId} for ${customer_name}`],
            (err) => {
                if (err) {
                    console.error('❌ Error logging activity:', err);
                }
            }
        );
        
        console.log("✅ Job Added Successfully:", result.insertId);
        res.json({ message: '✅ Job added successfully', job_ref: result.insertId });
    });
});

// ✅ Get Job by job_ref
app.get('/api/jobs/:job_ref', verifyToken, (req, res) => {
    const jobRef = req.params.job_ref;
    console.log(`🟢 API Request: Fetching Job with Ref: ${jobRef}`);
    
    // Make sure job_ref is a number
    if (isNaN(parseInt(jobRef))) {
        console.error(`❌ Invalid job_ref format: ${jobRef}`);
        return res.status(400).json({ error: 'Invalid job reference format' });
    }
    
    const sql = 'SELECT * FROM jobs WHERE job_ref = ?';
    
    pool.query(sql, [jobRef], (err, result) => {
        if (err) {
            console.error('❌ Error fetching job:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }
        
        if (result.length === 0) {
            console.warn(`⚠️ No job found with Ref: ${jobRef}`);
            return res.status(404).json({ error: 'Job not found' });
        }
        
        console.log("✅ Job Found:", result[0]);
        res.json(result[0]);
    });
});

// ✅ Get Engineer Report by `job_ref` - IMPROVED VERSION
app.get('/api/engineer-reports/:job_ref', verifyToken, (req, res) => {
    const jobRef = req.params.job_ref;

    console.log(`🟢 API Request: Fetching Engineer Report for Job Ref: ${jobRef}`); 

    // First, get the job to include its status
    const sqlJob = `SELECT * FROM jobs WHERE job_ref = ?`;
    
    pool.query(sqlJob, [jobRef], (err, jobResult) => {
        if (err) {
            console.error('❌ Error fetching job:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }

        if (jobResult.length === 0) {
            console.warn(`⚠️ No job found with Ref: ${jobRef}`);
            return res.status(404).json({ error: 'Job not found' });
        }

        const job = jobResult[0];
        
        // Then get the engineer report
        const sqlReport = `SELECT * FROM engineer_reports WHERE job_ref = ?`;
        
        pool.query(sqlReport, [jobRef], (err, reportResult) => {
            if (err) {
                console.error('❌ Error fetching engineer report:', err.message);
                return res.status(500).json({ error: 'Database query error' });
            }

            if (reportResult.length === 0) {
                // No report yet, return a shell with the job status
                console.warn(`⚠️ No engineer report found for Job Ref: ${jobRef}`);
                return res.json({
                    job_ref: jobRef,
                    engineer_name: "",
                    time_spent: "",
                    repair_notes: "",
                    status: job.status || "On Bench"
                });
            }

            // Combine the report with the job status
            const reportWithStatus = {
                ...reportResult[0],
                status: job.status || "On Bench"
            };

            console.log("✅ Engineer Report Found:", reportWithStatus);
            res.json(reportWithStatus);
        });
    });
});

// ✅ Create or Update Engineer Report and update Job Status
app.post('/api/engineer-reports', verifyToken, (req, res) => {
    const { job_ref, engineer_name, time_spent, repair_notes, status } = req.body;

    console.log(`🟢 Processing engineer report for job ${job_ref}`);

    if (!job_ref) {
        return res.status(400).json({ error: "❌ Missing job_ref in request" });
    }

    // Get a connection from the pool for the transaction
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('❌ Connection error:', err.message);
            return res.status(500).json({ error: 'Database connection error' });
        }

        // Begin a transaction
        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                console.error('❌ Transaction error:', err.message);
                return res.status(500).json({ error: 'Database transaction error' });
            }

            // Step 2: Update the job status
            const sqlUpdateJob = `UPDATE jobs SET status = ?, updated_by = ? WHERE job_ref = ?`;
            
            connection.query(sqlUpdateJob, [status || 'On Bench', req.user.id, job_ref], (err, result) => {
                if (err) {
                    console.error('❌ Job status update error:', err.message);
                    return connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ error: err.message });
                    });
                }

                // Step 3: Check if engineer report exists
                const sqlCheck = `SELECT * FROM engineer_reports WHERE job_ref = ?`;
                
                connection.query(sqlCheck, [job_ref], (err, result) => {
                    if (err) {
                        console.error('❌ Database query error:', err.message);
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ error: err.message });
                        });
                    }

                    let sqlOperation;
                    let params;

                    // Step 4: Either insert or update the engineer report
                    if (result.length > 0) {
                        // Update existing
                        sqlOperation = `UPDATE engineer_reports SET engineer_name = ?, time_spent = ?, repair_notes = ?, updated_by = ? WHERE job_ref = ?`;
                        params = [engineer_name, time_spent, repair_notes, req.user.id, job_ref];
                    } else {
                        // Insert new
                        sqlOperation = `INSERT INTO engineer_reports (job_ref, engineer_name, time_spent, repair_notes, updated_by) VALUES (?, ?, ?, ?, ?)`;
                        params = [job_ref, engineer_name, time_spent, repair_notes, req.user.id];
                    }

                    // Execute the operation
                    connection.query(sqlOperation, params, (err, operationResult) => {
                        if (err) {
                            console.error('❌ Engineer report operation error:', err.message);
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).json({ error: err.message });
                            });
                        }

                        // Log activity
                        const activity = result.length > 0 ? 'report_update' : 'report_create';
                        const activityDetails = `${result.length > 0 ? 'Updated' : 'Created'} engineer report for job #${job_ref}`;
                        
                        connection.query(
                            'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
                            [req.user.id, activity, activityDetails],
                            (err) => {
                                if (err) {
                                    console.error('❌ Error logging activity:', err);
                                    // Continue anyway - don't rollback just for logging
                                }
                                
                                // Step 5: Commit the transaction
                                connection.commit(err => {
                                    if (err) {
                                        console.error('❌ Commit error:', err.message);
                                        return connection.rollback(() => {
                                            connection.release();
                                            res.status(500).json({ error: 'Failed to commit transaction' });
                                        });
                                    }
                                    
                                    // Release the connection back to the pool
                                    connection.release();
                                    
                                    res.json({ 
                                        message: '✅ Engineer report and job status updated successfully',
                                        operation: result.length > 0 ? 'updated' : 'created'
                                    });
                                });
                            }
                        );
                    });
                });
            });
        });
    });
});

// ✅ Update Existing Job
app.put('/api/jobs/:job_ref', verifyToken, (req, res) => {
    const jobRef = req.params.job_ref;
    console.log("🟢 Updating Job:", jobRef, req.body);

    let { customer_name, contact_number, job_details, booked_in_by, deposit_paid, manufacturer, device_type, serial_number, additional_notes, status } = req.body;

    if (!customer_name || !contact_number) {
        return res.status(400).json({ error: "❌ Customer name & contact number are required!" });
    }

    // ✅ Fix deposit_paid (remove £ sign, ensure integer format)
    deposit_paid = deposit_paid.toString().replace(/[£,]/g, ""); 
    const depositAmount = parseInt(deposit_paid);

    if (isNaN(depositAmount)) {
        return res.status(400).json({ error: "❌ Invalid deposit amount format!" });
    }

    const sqlUpdate = `UPDATE jobs SET customer_name=?, contact_number=?, job_details=?, booked_in_by=?, deposit_paid=?, manufacturer=?, device_type=?, serial_number=?, additional_notes=?, status=?, updated_by=? WHERE job_ref=?`;

    pool.query(sqlUpdate, [customer_name, contact_number, job_details, booked_in_by, depositAmount, manufacturer, device_type, serial_number, additional_notes, status, req.user.id, jobRef], (err, result) => {
        if (err) {
            console.error('❌ Database update error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        // Log activity
        pool.query(
            'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
            [req.user.id, 'job_update', `Updated job #${jobRef} for ${customer_name}`],
            (err) => {
                if (err) {
                    console.error('❌ Error logging activity:', err);
                }
            }
        );
        
        console.log("✅ Job Updated Successfully:", jobRef);
        res.json({ message: '✅ Job updated successfully' });
    });
});

// ✅ Get Job Statistics
app.get('/api/statistics', verifyToken, (req, res) => {
    // Get simple job statistics grouped by status
    pool.query(
        `SELECT status, COUNT(*) as count FROM jobs GROUP BY status`,
        (err, results) => {
            if (err) {
                console.error('❌ Error fetching statistics:', err.message);
                return res.status(500).json({ error: 'Database query error' });
            }

            // Get today's jobs and deposits
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISOString = today.toISOString().split('T')[0];

            pool.query(
                `SELECT COUNT(*) as count, SUM(deposit_paid) as deposits 
                 FROM jobs 
                 WHERE DATE(checked_in_date) = ?`,
                [todayISOString],
                (err, todayResults) => {
                    if (err) {
                        console.error('❌ Error fetching today statistics:', err.message);
                        return res.status(500).json({ error: 'Database query error' });
                    }

                    // Format the response
                    const statusCounts = {};
                    results.forEach(row => {
                        statusCounts[row.status] = row.count;
                    });

                    res.json({
                        statusCounts,
                        todayJobs: todayResults[0].count || 0,
                        todayDeposits: todayResults[0].deposits || 0
                    });
                }
            );
        }
    );
});

// ✅ Get Engineer Workload
app.get('/api/engineers/workload', verifyToken, (req, res) => {
    pool.query(
        `SELECT er.engineer_name, COUNT(*) as job_count 
         FROM engineer_reports er
         JOIN jobs j ON er.job_ref = j.job_ref
         WHERE j.status IN ('On Bench', 'Queued')
         GROUP BY er.engineer_name`,
        (err, results) => {
            if (err) {
                console.error('❌ Error fetching engineer workload:', err.message);
                return res.status(500).json({ error: 'Database query error' });
            }
            
            res.json(results);
        }
    );
});

// ✅ Get Latest Jobs (used for dashboard)
app.get('/api/jobs/latest/:count', verifyToken, (req, res) => {
    const count = parseInt(req.params.count) || 5;
    
    pool.query(
        `SELECT * FROM jobs ORDER BY checked_in_date DESC LIMIT ?`,
        [count],
        (err, results) => {
            if (err) {
                console.error('❌ Error fetching latest jobs:', err.message);
                return res.status(500).json({ error: 'Database query error' });
            }
            
            res.json(results);
        }
    );
});

// ===== GRACEFUL SHUTDOWN =====
// Handle graceful shutdown for SIGTERM and SIGINT (Ctrl+C)
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    console.log('🔄 Received shutdown signal, closing connections gracefully...');
    
    // Close the pool
    pool.end(err => {
        if (err) {
            console.error('❌ Error closing pool during shutdown', err);
            process.exit(1);
        }
        
        console.log('✅ All database connections closed.');
        process.exit(0);
    });
    
    // If after 5 seconds the app hasn't closed, force exit
    setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 5000);
}

// Function to ensure default admin user exists
const initializeDefaultAdminUser = async () => {
  try {
    console.log('🔄 Checking for default admin user...');
    
    // Check if admin user exists
    pool.query('SELECT * FROM users WHERE username = ?', ['admin'], async (err, results) => {
      if (err) {
        return console.error('❌ Error checking for admin user:', err);
      }
      
      // If admin doesn't exist, create one
      if (results.length === 0) {
        console.log('⚠️ No admin user found. Creating default admin account...');
        
        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        // Create admin user
        const adminUser = {
          username: 'admin',
          password: hashedPassword,
          full_name: 'System Administrator',
          role: 'admin',
          created_at: new Date()
        };
        
        pool.query('INSERT INTO users SET ?', adminUser, (err, result) => {
          if (err) {
            return console.error('❌ Failed to create admin user:', err);
          }
          console.log('✅ Default admin user created successfully!');
        });
      } else {
        console.log('✅ Admin user already exists.');
      }
    });
  } catch (error) {
    console.error('❌ Error in admin user initialization:', error);
  }
};

// Call the function after database connection is established
initializeDefaultAdminUser();

// Change password endpoint
app.post('/api/users/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new passwords are required' });
    }
    
    // Get the user from the database
    pool.query('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, results) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = results[0];
      
      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      
      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update the password
      pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id], (err, result) => {
        if (err) {
          console.error('❌ Database error:', err);
          return res.status(500).json({ error: 'Failed to update password' });
        }
        
        // Log activity
        pool.query(
          'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
          [req.user.id, 'password_change', 'User changed their password'],
          (err) => {
            if (err) {
              console.error('❌ Error logging activity:', err);
            }
          }
        );
        
        res.json({ message: 'Password changed successfully' });
      });
    });
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile information
app.get('/api/users/profile', verifyToken, (req, res) => {
  pool.query(
    'SELECT id, username, full_name, role, created_at FROM users WHERE id = ?', 
    [req.user.id], 
    (err, results) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(results[0]);
    }
  );
});

// For admin: Get user activity statistics
app.get('/api/users/activity-stats', verifyToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Query to get activity counts by user and type
  const query = `
    SELECT 
      u.id, 
      u.username, 
      u.full_name,
      COUNT(DISTINCT CASE WHEN a.activity_type = 'login' THEN a.id END) as login_count,
      COUNT(DISTINCT CASE WHEN a.activity_type = 'job_create' THEN a.id END) as job_created,
      COUNT(DISTINCT CASE WHEN a.activity_type = 'job_update' THEN a.id END) as job_updated,
      COUNT(DISTINCT CASE WHEN a.activity_type = 'report_update' THEN a.id END) as reports_updated,
      COUNT(DISTINCT a.id) as total_activities
    FROM 
      users u
    LEFT JOIN 
      activity_logs a ON u.id = a.user_id
    GROUP BY 
      u.id
    ORDER BY 
      total_activities DESC;
  `;
  
  pool.query(query, (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(results);
  });
});

// Update user profile (name only)
app.put('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const { fullName } = req.body;
    
    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    
    // Update the user's full name
    pool.query(
      'UPDATE users SET full_name = ? WHERE id = ?',
      [fullName, req.user.id],
      (err, result) => {
        if (err) {
          console.error('❌ Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Log activity
        pool.query(
          'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
          [req.user.id, 'profile_update', 'Updated profile information'],
          (err) => {
            if (err) {
              console.error('❌ Error logging activity:', err);
            }
          }
        );
        
        res.json({ message: 'Profile updated successfully' });
      }
    );
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's own activity logs
app.get('/api/activity/me', verifyToken, (req, res) => {
  pool.query(
    'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50',
    [req.user.id],
    (err, results) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(results);
    }
  );
});

// Enhanced endpoint to get activity logs with user information (admin only)
app.get('/api/activity', verifyToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  let query = `
    SELECT 
      al.*,
      u.username,
      u.full_name
    FROM 
      activity_logs al
    JOIN 
      users u ON al.user_id = u.id
  `;
  
  const params = [];
  
  // Filter by user if specified
  if (req.query.userId) {
    query += ' WHERE al.user_id = ?';
    params.push(req.query.userId);
  }
  
  // Filter by activity type if specified
  if (req.query.type) {
    query += params.length ? ' AND' : ' WHERE';
    query += ' al.activity_type = ?';
    params.push(req.query.type);
  }
  
  // Add order by and limit
  query += ' ORDER BY al.timestamp DESC LIMIT 100';
  
  pool.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(results);
  });
});

// Delete user (admin only)
app.delete('/api/users/:id', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    
    const userId = parseInt(req.params.id);
    
    // Prevent deleting your own account
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    
    // Get the user to be deleted (for logging purposes)
    pool.query('SELECT username FROM users WHERE id = ?', [userId], (err, results) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const username = results[0].username;
      
      // Start a transaction to handle deleting related records
      pool.getConnection((err, connection) => {
        if (err) {
          console.error('❌ Connection error:', err);
          return res.status(500).json({ error: 'Database connection error' });
        }
        
        connection.beginTransaction(err => {
          if (err) {
            connection.release();
            console.error('❌ Transaction error:', err);
            return res.status(500).json({ error: 'Database transaction error' });
          }
          
          // 1. Delete activity logs (optional, you might want to keep these)
          connection.query('DELETE FROM activity_logs WHERE user_id = ?', [userId], (err) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('❌ Error deleting activity logs:', err);
                res.status(500).json({ error: 'Error deleting user data' });
              });
            }
            
            // 2. Update jobs to set created_by and updated_by to NULL where they reference this user
            connection.query('UPDATE jobs SET created_by = NULL WHERE created_by = ?', [userId], (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('❌ Error updating jobs created_by:', err);
                  res.status(500).json({ error: 'Error deleting user data' });
                });
              }
              
              connection.query('UPDATE jobs SET updated_by = NULL WHERE updated_by = ?', [userId], (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error('❌ Error updating jobs updated_by:', err);
                    res.status(500).json({ error: 'Error deleting user data' });
                  });
                }
                
                // 3. Update engineer_reports to set updated_by to NULL where they reference this user
                connection.query('UPDATE engineer_reports SET updated_by = NULL WHERE updated_by = ?', [userId], (err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      console.error('❌ Error updating engineer reports:', err);
                      res.status(500).json({ error: 'Error deleting user data' });
                    });
                  }
                  
                  // 4. Finally delete the user
                  connection.query('DELETE FROM users WHERE id = ?', [userId], (err, result) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        console.error('❌ Error deleting user:', err);
                        res.status(500).json({ error: 'Error deleting user' });
                      });
                    }
                    
                    if (result.affectedRows === 0) {
                      return connection.rollback(() => {
                        connection.release();
                        res.status(404).json({ error: 'User not found' });
                      });
                    }
                    
                    // Log the activity
                    connection.query(
                      'INSERT INTO activity_logs (user_id, activity_type, details) VALUES (?, ?, ?)',
                      [req.user.id, 'user_delete', `Deleted user: ${username}`],
                      (err) => {
                        if (err) {
                          console.error('❌ Error logging activity:', err);
                          // Continue anyway - don't rollback just for logging
                        }
                        
                        // Commit the transaction
                        connection.commit(err => {
                          if (err) {
                            return connection.rollback(() => {
                              connection.release();
                              console.error('❌ Commit error:', err);
                              res.status(500).json({ error: 'Failed to commit transaction' });
                            });
                          }
                          
                          connection.release();
                          res.json({ message: 'User deleted successfully' });
                        });
                      }
                    );
                  });
                });
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test SMS functionality directly
app.get('/api/test-sms', verifyToken, async (req, res) => {
  console.log("🧪 Testing SMS functionality...");
  
  try {
    // Log Vonage configuration
    const vonageConfig = {
      apiKeyPresent: !!process.env.VONAGE_API_KEY,
      apiSecretPresent: !!process.env.VONAGE_API_SECRET,
      apiKeyValue: process.env.VONAGE_API_KEY ? `${process.env.VONAGE_API_KEY.substring(0, 4)}...` : 'Missing',
      tlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED
    };
    
    console.log("📊 Vonage Config:", vonageConfig);
    
    // Check if we can access Vonage object
    console.log("🔍 Vonage object initialized:", !!vonage);
    
    // Try to send a test SMS to a test number
    const testNumber = '+447700900000'; // This is a Vonage test number
    
    console.log("📱 Attempting to send SMS to test number:", testNumber);
    
    const response = await vonage.sms.send({
      to: testNumber,
      from: "TEST",
      text: "This is a test message from your IT Repair System"
    });
    
    console.log("📬 Vonage SMS Response:", JSON.stringify(response, null, 2));
    
    return res.json({
      success: true,
      message: "SMS test completed - check server logs",
      vonageConfig,
      response
    });
  } catch (error) {
    console.error("❌ SMS Test Error:", error);
    console.error("❌ Error details:", {
      name: error.name,
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      message: "SMS test failed",
      error: error.message,
      errorDetails: {
        name: error.name,
        code: error.code
      }
    });
  }
});

// Configure HTTPS server with your certificate
const certPath = path.resolve('C:\\IT-Repair-System\\client\\ncc-workshop-01_ad_newrycomputercentre_co_uk.crt');
const keyPath = path.resolve('C:\\IT-Repair-System\\client\\ncc-workshop-01.ad.newrycomputercentre.co.uk.key');

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
  console.log(`🚀 HTTPS Server running on https://${HOST}:${PORT}`);
});