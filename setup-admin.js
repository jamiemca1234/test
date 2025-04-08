// Save this as setup-admin.js
require('dotenv').config();
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

// Create a database connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST || '192.168.250.43',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Password123!',
  database: process.env.DB_NAME || 'it_repair_system'
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL Database successfully!');
  
  // Check if the users table exists
  connection.query(`SHOW TABLES LIKE 'users'`, (err, results) => {
    if (err) {
      console.error('❌ Error checking tables:', err.message);
      connection.end();
      process.exit(1);
    }
    
    if (results.length === 0) {
      console.log('⚠️ Users table does not exist. Creating database schema...');
      createDatabaseSchema();
    } else {
      // Check if admin user exists
      checkForAdminUser();
    }
  });
});

// Create the database schema
function createDatabaseSchema() {
  const schema = `
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      role ENUM('admin', 'staff', 'tech') DEFAULT 'staff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Jobs table
  CREATE TABLE IF NOT EXISTS jobs (
      job_ref INT AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(100) NOT NULL,
      contact_number VARCHAR(20) NOT NULL,
      job_details TEXT,
      booked_in_by VARCHAR(100),
      deposit_paid INT DEFAULT 0,
      manufacturer VARCHAR(50),
      device_type VARCHAR(50),
      additional_notes TEXT,
      status ENUM('Queued', 'On Bench', 'Waiting for Customer', 'Repaired', 'Unrepaired') DEFAULT 'Queued',
      checked_in_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INT,
      updated_by INT
  );

  -- Engineer reports table
  CREATE TABLE IF NOT EXISTS engineer_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_ref INT NOT NULL,
      engineer_name VARCHAR(100),
      time_spent VARCHAR(50),
      repair_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INT
  );

  -- Activity logs table
  CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      activity_type VARCHAR(50) NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  `;

  connection.query(schema, (err) => {
    if (err) {
      console.error('❌ Error creating database schema:', err.message);
      connection.end();
      process.exit(1);
    }
    console.log('✅ Database schema created successfully!');
    
    // Now check for admin user
    checkForAdminUser();
  });
}

// Check if admin user exists
function checkForAdminUser() {
  connection.query('SELECT * FROM users WHERE username = ?', ['admin'], (err, results) => {
    if (err) {
      console.error('❌ Error checking for admin user:', err.message);
      connection.end();
      process.exit(1);
    }
    
    if (results.length === 0) {
      console.log('⚠️ Admin user does not exist. Creating admin user...');
      createAdminUser();
    } else {
      console.log('✅ Admin user already exists.');
      console.log('🔑 To reset the admin password to "admin123", run with --reset flag');
      
      // Check if --reset flag was passed
      if (process.argv.includes('--reset')) {
        resetAdminPassword();
      } else {
        connection.end();
      }
    }
  });
}

// Create admin user
async function createAdminUser() {
  try {
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
    
    connection.query('INSERT INTO users SET ?', adminUser, (err) => {
      if (err) {
        console.error('❌ Error creating admin user:', err.message);
        connection.end();
        process.exit(1);
      }
      console.log('✅ Admin user created successfully!');
      console.log('👤 Username: admin');
      console.log('🔑 Password: admin123');
      connection.end();
    });
  } catch (error) {
    console.error('❌ Error in admin user creation:', error);
    connection.end();
    process.exit(1);
  }
}

// Reset admin password
async function resetAdminPassword() {
  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    connection.query('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'admin'], (err) => {
      if (err) {
        console.error('❌ Error resetting admin password:', err.message);
        connection.end();
        process.exit(1);
      }
      console.log('✅ Admin password reset successfully!');
      console.log('👤 Username: admin');
      console.log('🔑 Password: admin123');
      connection.end();
    });
  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
    connection.end();
    process.exit(1);
  }
}