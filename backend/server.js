// =====================================================
// MIS SYSTEM - BACKEND SERVER (FIXED VERSION)
// File: backend/server.js
// =====================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: '../config/.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// PostgreSQL connection - FIXED VERSION
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test database connection
pool.connect()
    .then(client => {
        console.log('✅ Connected to PostgreSQL database');
        client.release();
    })
    .catch(err => console.error('❌ Database connection error:', err.message));

// Routes

// Get all chart of accounts
app.get('/api/accounts', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(`
            SELECT 
                id,
                pts_account_no,
                name,
                short_name,
                created_by,
                acc_type_code_debit,
                acc_type_code_credit,
                created_on,
                updated_on
            FROM chart_of_accounts 
            ORDER BY pts_account_no::numeric
        `);
        
        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching chart of accounts',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// Get single account by PTS Account Number
app.get('/api/accounts/:pts_account_no', async (req, res) => {
    let client;
    try {
        const { pts_account_no } = req.params;
        client = await pool.connect();
        const result = await client.query(
            'SELECT * FROM chart_of_accounts WHERE pts_account_no = $1',
            [pts_account_no]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching account:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching account',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// Update account name and details
app.put('/api/accounts/:pts_account_no', async (req, res) => {
    let client;
    try {
        const { pts_account_no } = req.params;
        let { name, short_name, acc_type_code_debit, acc_type_code_credit } = req.body;
        
        // Validate and truncate data to prevent errors
        name = name ? name.toString().substring(0, 500) : null;
        short_name = short_name ? short_name.toString().substring(0, 150) : null;
        acc_type_code_debit = acc_type_code_debit ? acc_type_code_debit.toString().substring(0, 50) : null;
        acc_type_code_credit = acc_type_code_credit ? acc_type_code_credit.toString().substring(0, 50) : null;
        
        client = await pool.connect();
        const result = await client.query(`
            UPDATE chart_of_accounts 
            SET 
                name = $1,
                short_name = $2,
                acc_type_code_debit = $3,
                acc_type_code_credit = $4,
                updated_on = CURRENT_TIMESTAMP
            WHERE pts_account_no = $5
            RETURNING *
        `, [name, short_name, acc_type_code_debit, acc_type_code_credit, pts_account_no]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Account updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating account:', error);
        
        // Better error handling for database constraints
        if (error.code === '22001') {
            return res.status(400).json({
                success: false,
                message: 'Data too long for database field. Please shorten your input.',
                error: 'Value exceeds maximum length'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error updating account',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// Create new account
app.post('/api/accounts', async (req, res) => {
    let client;
    try {
        let { pts_account_no, name, short_name, acc_type_code_debit, acc_type_code_credit } = req.body;
        
        // Validate required fields
        if (!pts_account_no || !name) {
            return res.status(400).json({
                success: false,
                message: 'PTS Account Number and Name are required'
            });
        }
        
        // Validate and truncate data
        pts_account_no = pts_account_no.toString().substring(0, 20);
        name = name.toString().substring(0, 500);
        short_name = short_name ? short_name.toString().substring(0, 150) : null;
        acc_type_code_debit = acc_type_code_debit ? acc_type_code_debit.toString().substring(0, 50) : null;
        acc_type_code_credit = acc_type_code_credit ? acc_type_code_credit.toString().substring(0, 50) : null;
        
        client = await pool.connect();
        const result = await client.query(`
            INSERT INTO chart_of_accounts 
            (pts_account_no, name, short_name, acc_type_code_debit, acc_type_code_credit, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [pts_account_no, name, short_name, acc_type_code_debit, acc_type_code_credit, 'USER']);
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating account:', error);
        
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Account number already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error creating account',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// Delete account
app.delete('/api/accounts/:pts_account_no', async (req, res) => {
    let client;
    try {
        const { pts_account_no } = req.params;
        
        client = await pool.connect();
        const result = await client.query(
            'DELETE FROM chart_of_accounts WHERE pts_account_no = $1 RETURNING *',
            [pts_account_no]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Account deleted successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting account',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// Search accounts
app.get('/api/accounts/search/:query', async (req, res) => {
    let client;
    try {
        const { query } = req.params;
        client = await pool.connect();
        const result = await client.query(`
            SELECT * FROM chart_of_accounts 
            WHERE 
                pts_account_no ILIKE $1 OR 
                name ILIKE $1 OR 
                short_name ILIKE $1
            ORDER BY pts_account_no::numeric
        `, [`%${query}%`]);
        
        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error searching accounts:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching accounts',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        
        const totalAccounts = await client.query('SELECT COUNT(*) FROM chart_of_accounts');
        const namedAccounts = await client.query('SELECT COUNT(*) FROM chart_of_accounts WHERE name IS NOT NULL AND name != \'\'');
        const recentAccounts = await client.query(`
            SELECT COUNT(*) FROM chart_of_accounts 
            WHERE created_on >= CURRENT_DATE - INTERVAL '7 days'
        `);
        
        res.json({
            success: true,
            data: {
                totalAccounts: parseInt(totalAccounts.rows[0].count),
                namedAccounts: parseInt(namedAccounts.rows[0].count),
                unnamedAccounts: parseInt(totalAccounts.rows[0].count) - parseInt(namedAccounts.rows[0].count),
                recentAccounts: parseInt(recentAccounts.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 MIS System Backend running on http://localhost:${PORT}`);
    console.log(`📊 Access the application at: http://localhost:${PORT}`);
});

// Graceful shutdown - FIXED VERSION
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`\n⏹️  Received ${signal}. Shutting down gracefully...`);
    
    // Close server
    server.close(() => {
        console.log('✅ HTTP server closed');
    });
    
    // Close database pool
    try {
        await pool.end();
        console.log('✅ Database pool closed');
    } catch (error) {
        console.log('⚠️  Error closing database pool:', error.message);
    }
    
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});