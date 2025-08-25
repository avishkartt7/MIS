// =====================================================
// MIS SYSTEM - MINIMAL WORKING SERVER
// File: backend/server.js
// Guaranteed fix for pool issues - completely fresh approach
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
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Simple, robust database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password',
    max: 5,
    min: 1,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 5000
};

let pool = new Pool(dbConfig);

// Test connection on startup
(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
    }
})();

// Simple query helper
async function queryDB(text, params = []) {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release();
    }
}

// Routes

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await queryDB('SELECT 1');
        res.json({ success: true, message: 'Server healthy', timestamp: new Date() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all accounts
app.get('/api/accounts', async (req, res) => {
    try {
        console.log('📊 Fetching accounts...');
        
        const result = await queryDB(`
            SELECT 
                id, pts_account_no, name, acc_type_code_debit, acc_type_code_credit,
                short_name, created_by, created_on, updated_by, updated_on
            FROM chart_of_accounts 
            ORDER BY pts_account_no::numeric
        `);
        
        console.log(`✅ Found ${result.rows.length} accounts`);
        
        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('❌ Error fetching accounts:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching accounts',
            error: error.message
        });
    }
});

// Get stats
app.get('/api/stats', async (req, res) => {
    try {
        console.log('📈 Fetching statistics...');
        
        const totalResult = await queryDB('SELECT COUNT(*) FROM chart_of_accounts');
        const namedResult = await queryDB(`SELECT COUNT(*) FROM chart_of_accounts WHERE name IS NOT NULL AND name != ''`);
        const recentResult = await queryDB(`SELECT COUNT(*) FROM chart_of_accounts WHERE created_on >= CURRENT_DATE - INTERVAL '7 days'`);
        
        const stats = {
            totalAccounts: parseInt(totalResult.rows[0].count),
            namedAccounts: parseInt(namedResult.rows[0].count),
            unnamedAccounts: parseInt(totalResult.rows[0].count) - parseInt(namedResult.rows[0].count),
            recentAccounts: parseInt(recentResult.rows[0].count)
        };
        
        console.log('✅ Statistics:', stats);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error fetching stats:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error.message
        });
    }
});

// Get single account
app.get('/api/accounts/:pts_account_no', async (req, res) => {
    try {
        const result = await queryDB(
            'SELECT * FROM chart_of_accounts WHERE pts_account_no = $1',
            [req.params.pts_account_no]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching account:', error.message);
        res.status(500).json({ success: false, message: 'Error fetching account', error: error.message });
    }
});

// Create account
app.post('/api/accounts', async (req, res) => {
    try {
        const { pts_account_no, name, short_name, acc_type_code_debit, acc_type_code_credit } = req.body;
        
        if (!pts_account_no || !name) {
            return res.status(400).json({ success: false, message: 'Account number and name required' });
        }
        
        const result = await queryDB(`
            INSERT INTO chart_of_accounts 
            (pts_account_no, name, short_name, acc_type_code_debit, acc_type_code_credit, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            pts_account_no.substring(0, 20),
            name.substring(0, 500), 
            short_name ? short_name.substring(0, 150) : null,
            acc_type_code_debit ? acc_type_code_debit.substring(0, 50) : null,
            acc_type_code_credit ? acc_type_code_credit.substring(0, 50) : null,
            'USER',
            'USER'
        ]);
        
        res.status(201).json({ success: true, message: 'Account created', data: result.rows[0] });
    } catch (error) {
        console.error('Error creating account:', error.message);
        
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Account number already exists' });
        }
        
        res.status(500).json({ success: false, message: 'Error creating account', error: error.message });
    }
});

// Update account
app.put('/api/accounts/:pts_account_no', async (req, res) => {
    try {
        const { name, short_name, acc_type_code_debit, acc_type_code_credit, updated_by } = req.body;
        
        const result = await queryDB(`
            UPDATE chart_of_accounts 
            SET name = $1, short_name = $2, acc_type_code_debit = $3, 
                acc_type_code_credit = $4, updated_by = $5, updated_on = CURRENT_TIMESTAMP
            WHERE pts_account_no = $6
            RETURNING *
        `, [
            name ? name.substring(0, 500) : null,
            short_name ? short_name.substring(0, 150) : null,
            acc_type_code_debit ? acc_type_code_debit.substring(0, 50) : null,
            acc_type_code_credit ? acc_type_code_credit.substring(0, 50) : null,
            updated_by || 'USER',
            req.params.pts_account_no
        ]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }
        
        res.json({ success: true, message: 'Account updated', data: result.rows[0] });
    } catch (error) {
        console.error('Error updating account:', error.message);
        res.status(500).json({ success: false, message: 'Error updating account', error: error.message });
    }
});

// Delete account
app.delete('/api/accounts/:pts_account_no', async (req, res) => {
    try {
        const result = await queryDB(
            'DELETE FROM chart_of_accounts WHERE pts_account_no = $1 RETURNING *',
            [req.params.pts_account_no]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }
        
        res.json({ success: true, message: 'Account deleted', data: result.rows[0] });
    } catch (error) {
        console.error('Error deleting account:', error.message);
        res.status(500).json({ success: false, message: 'Error deleting account', error: error.message });
    }
});

// Bulk import
app.post('/api/accounts/bulk-import', async (req, res) => {
    try {
        const { accounts } = req.body;
        
        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({ success: false, message: 'No accounts provided' });
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        console.log(`🔄 Importing ${accounts.length} accounts...`);
        
        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            
            try {
                const pts_account_no = account.pts_account_no ? String(account.pts_account_no).trim() : '';
                const name = account.name ? String(account.name).trim() : '';
                
                if (!pts_account_no || !name) {
                    errorCount++;
                    errors.push(`Row ${i + 1}: Missing account number or name`);
                    continue;
                }
                
                // Check if exists
                const existingResult = await queryDB(
                    'SELECT pts_account_no FROM chart_of_accounts WHERE pts_account_no = $1',
                    [pts_account_no]
                );
                
                if (existingResult.rows.length > 0) {
                    // Update
                    await queryDB(`
                        UPDATE chart_of_accounts 
                        SET name = $2, short_name = $3, acc_type_code_debit = $4, 
                            acc_type_code_credit = $5, updated_by = $6, updated_on = CURRENT_TIMESTAMP
                        WHERE pts_account_no = $1
                    `, [
                        pts_account_no,
                        name.substring(0, 500),
                        account.short_name ? String(account.short_name).substring(0, 150) : null,
                        account.acc_type_code_debit ? String(account.acc_type_code_debit).substring(0, 50) : null,
                        account.acc_type_code_credit ? String(account.acc_type_code_credit).substring(0, 50) : null,
                        account.updated_by || 'IMPORT'
                    ]);
                } else {
                    // Insert
                    await queryDB(`
                        INSERT INTO chart_of_accounts 
                        (pts_account_no, name, short_name, acc_type_code_debit, acc_type_code_credit, created_by, updated_by)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        pts_account_no,
                        name.substring(0, 500),
                        account.short_name ? String(account.short_name).substring(0, 150) : null,
                        account.acc_type_code_debit ? String(account.acc_type_code_debit).substring(0, 50) : null,
                        account.acc_type_code_credit ? String(account.acc_type_code_credit).substring(0, 50) : null,
                        account.created_by || 'IMPORT',
                        account.updated_by || 'IMPORT'
                    ]);
                }
                
                successCount++;
                
            } catch (accountError) {
                errorCount++;
                errors.push(`Row ${i + 1}: ${accountError.message}`);
                console.error(`❌ Error processing account ${i + 1}:`, accountError.message);
            }
        }
        
        console.log(`✅ Import completed: ${successCount} success, ${errorCount} errors`);
        
        res.json({
            success: true,
            message: `Import completed: ${successCount} successful, ${errorCount} errors`,
            data: {
                successCount,
                errorCount,
                totalProcessed: accounts.length,
                errors: errors.slice(0, 10)
            }
        });
        
    } catch (error) {
        console.error('❌ Bulk import error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Bulk import failed',
            error: error.message
        });
    }
});

// Search accounts
app.get('/api/accounts/search/:query', async (req, res) => {
    try {
        const result = await queryDB(`
            SELECT * FROM chart_of_accounts 
            WHERE pts_account_no ILIKE $1 OR name ILIKE $1 OR short_name ILIKE $1 
               OR acc_type_code_debit ILIKE $1 OR acc_type_code_credit ILIKE $1
            ORDER BY pts_account_no::numeric
        `, [`%${req.params.query}%`]);
        
        res.json({ success: true, data: result.rows, total: result.rows.length });
    } catch (error) {
        console.error('Error searching accounts:', error.message);
        res.status(500).json({ success: false, message: 'Error searching', error: error.message });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Graceful shutdown - SIMPLE VERSION
process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        if (pool) {
            pool.end(() => {
                console.log('✅ Database closed');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
});