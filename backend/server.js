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



// =====================================================
// GENERAL LEDGER BACKEND ROUTES
// Add these routes to your existing backend/server.js
// =====================================================

// General Ledger Routes

// Get all general ledger entries with filtering and pagination
app.get('/api/general-ledger', async (req, res) => {
    try {
        console.log('📊 Fetching general ledger entries for P&L...');
        
        const { 
            page = 1, 
            limit = 50, 
            search = '', 
            account = '',
            date_from = '',
            date_to = '',
            jv_number = '',
            batch_number = '',
            transaction_type = '',
            currency = '',
            debit_credit = '',
            pending_only = '',
            locked_only = '',
            // NEW PARAMETERS FOR P&L
            year = '',
            month = '',
            month_from = '',
            month_to = ''
        } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramCounter = 1;


        // Existing filters (keep all your existing filter logic here)
        if (search) {
            whereConditions.push(`(
                jv_number ILIKE $${paramCounter} OR 
                description ILIKE $${paramCounter} OR 
                doc_ref ILIKE $${paramCounter} OR
                account_name ILIKE $${paramCounter}
            )`);
            queryParams.push(`%${search}%`);
            paramCounter++;
        }

        if (account) {
            whereConditions.push(`account_number = $${paramCounter}`);
            queryParams.push(account);
            paramCounter++;
        }

        if (date_from) {
            whereConditions.push(`transaction_date >= $${paramCounter}`);
            queryParams.push(date_from);
            paramCounter++;
        }
        
        if (date_to) {
            whereConditions.push(`transaction_date <= $${paramCounter}`);
            queryParams.push(date_to);
            paramCounter++;
        }

        // NEW: Year filter for P&L
        if (year) {
            whereConditions.push(`EXTRACT(YEAR FROM transaction_date) = $${paramCounter}`);
            queryParams.push(year);
            paramCounter++;
        }

        // NEW: Month filter for P&L
        if (month) {
            whereConditions.push(`EXTRACT(MONTH FROM transaction_date) = $${paramCounter}`);
            queryParams.push(month);
            paramCounter++;
        }

        // NEW: Month range filter for P&L (for cumulative)
        if (month_from) {
            whereConditions.push(`EXTRACT(MONTH FROM transaction_date) >= $${paramCounter}`);
            queryParams.push(month_from);
            paramCounter++;
        }

        if (month_to) {
            whereConditions.push(`EXTRACT(MONTH FROM transaction_date) <= $${paramCounter}`);
            queryParams.push(month_to);
            paramCounter++;
        }

        // Continue with existing filters...
        if (jv_number) {
            whereConditions.push(`jv_number ILIKE $${paramCounter}`);
            queryParams.push(`%${jv_number}%`);
            paramCounter++;
        }

        if (batch_number) {
            whereConditions.push(`batch_number ILIKE $${paramCounter}`);
            queryParams.push(`%${batch_number}%`);
            paramCounter++;
        }

        if (transaction_type) {
            whereConditions.push(`transaction_type = $${paramCounter}`);
            queryParams.push(transaction_type);
            paramCounter++;
        }

        if (currency) {
            whereConditions.push(`currency_code = $${paramCounter}`);
            queryParams.push(currency);
            paramCounter++;
        }

        if (debit_credit) {
            whereConditions.push(`debit_credit = $${paramCounter}`);
            queryParams.push(debit_credit);
            paramCounter++;
        }

        if (pending_only === 'true') {
            whereConditions.push('is_pending = true');
        }

        if (locked_only === 'true') {
            whereConditions.push('is_locked = true');
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Count total records
        const countQuery = `
            SELECT COUNT(*) 
            FROM general_ledger 
            ${whereClause}
        `;
        
        const countResult = await queryDB(countQuery, queryParams);
        const totalRecords = parseInt(countResult.rows[0].count);

        // Calculate pagination
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(totalRecords / limit);

        // Main query with pagination
        const mainQuery = `
            SELECT 
                id,
                transaction_date,
                jv_number,
                year_period,
                batch_number,
                batch_sequence,
                transaction_type,
                type_sequence,
                account_number,
                auxiliary_account,
                account_name,
                cc2,
                shipment,
                doc_ref,
                doc_date,
                m_classification,
                description,
                debit_credit,
                currency_code,
                foreign_amount,
                aed_amount,
                usd_amount,
                is_pending,
                is_locked,
                created_by,
                created_on,
                updated_by,
                updated_on
            FROM general_ledger 
            ${whereClause}
            ORDER BY transaction_date DESC, jv_number, type_sequence
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
        `;

        queryParams.push(limit, offset);
        const result = await queryDB(mainQuery, queryParams);

        console.log(`✅ Found ${result.rows.length} general ledger entries`);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalRecords,
                recordsPerPage: parseInt(limit),
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Error fetching general ledger:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching general ledger entries',
            error: error.message
        });
    }
});

// Get single general ledger entry
app.get('/api/general-ledger/:id', async (req, res) => {
    try {
        const result = await queryDB(`
            SELECT 
                id, transaction_date, jv_number, year_period, batch_number, batch_sequence,
                transaction_type, type_sequence, account_number, auxiliary_account, account_name,
                cc2, shipment, doc_ref, doc_date, m_classification, description, debit_credit,
                currency_code, foreign_amount, aed_amount, usd_amount, is_pending, is_locked,
                created_by, created_on, updated_by, updated_on
            FROM general_ledger 
            WHERE id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Entry not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching entry:', error.message);
        res.status(500).json({ success: false, message: 'Error fetching entry', error: error.message });
    }
});

// Create new general ledger entry
app.post('/api/general-ledger', async (req, res) => {
    try {
        const {
            transaction_date, jv_number, year_period, batch_number, batch_sequence,
            transaction_type, type_sequence, account_number, auxiliary_account, account_name,
            cc2, shipment, doc_ref, doc_date, m_classification, description, debit_credit,
            currency_code, foreign_amount, aed_amount, usd_amount, is_pending, is_locked,
            created_by
        } = req.body;

        // Validate required fields
        if (!transaction_date || !jv_number || !year_period || !account_number) {
            return res.status(400).json({ 
                success: false, 
                message: 'Required fields: transaction_date, jv_number, year_period, account_number' 
            });
        }

        // Validate account exists in chart of accounts
        const accountCheck = await queryDB(
            'SELECT pts_account_no FROM chart_of_accounts WHERE pts_account_no = $1',
            [account_number]
        );

        if (accountCheck.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid account number. Account does not exist in chart of accounts.' 
            });
        }

        const result = await queryDB(`
            INSERT INTO general_ledger (
                transaction_date, jv_number, year_period, batch_number, batch_sequence,
                transaction_type, type_sequence, account_number, auxiliary_account, account_name,
                cc2, shipment, doc_ref, doc_date, m_classification, description, debit_credit,
                currency_code, foreign_amount, aed_amount, usd_amount, is_pending, is_locked,
                created_by, updated_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25
            ) RETURNING *
        `, [
            transaction_date, jv_number, year_period, batch_number, batch_sequence,
            transaction_type, type_sequence, account_number, auxiliary_account, account_name,
            cc2, shipment, doc_ref, doc_date, m_classification, description, debit_credit,
            currency_code, foreign_amount, aed_amount, usd_amount, is_pending || false, is_locked || false,
            created_by || 'USER', created_by || 'USER'
        ]);

        res.status(201).json({ 
            success: true, 
            message: 'General ledger entry created successfully', 
            data: result.rows[0] 
        });

    } catch (error) {
        console.error('Error creating entry:', error.message);
        
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Duplicate entry' });
        }
        
        if (error.code === '23503') {
            return res.status(400).json({ success: false, message: 'Invalid account number reference' });
        }

        res.status(500).json({ success: false, message: 'Error creating entry', error: error.message });
    }
});

// Update general ledger entry
app.put('/api/general-ledger/:id', async (req, res) => {
    try {
        const {
            transaction_date, jv_number, year_period, batch_number, batch_sequence,
            transaction_type, type_sequence, account_number, auxiliary_account, account_name,
            cc2, shipment, doc_ref, doc_date, m_classification, description, debit_credit,
            currency_code, foreign_amount, aed_amount, usd_amount, is_pending, is_locked,
            updated_by
        } = req.body;

        // Check if entry is locked
        const lockCheck = await queryDB('SELECT is_locked FROM general_ledger WHERE id = $1', [req.params.id]);
        
        if (lockCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Entry not found' });
        }

        if (lockCheck.rows[0].is_locked) {
            return res.status(400).json({ success: false, message: 'Cannot update locked entry' });
        }

        // Validate account if provided
        if (account_number) {
            const accountCheck = await queryDB(
                'SELECT pts_account_no FROM chart_of_accounts WHERE pts_account_no = $1',
                [account_number]
            );

            if (accountCheck.rows.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid account number. Account does not exist in chart of accounts.' 
                });
            }
        }

        const result = await queryDB(`
            UPDATE general_ledger SET
                transaction_date = COALESCE($1, transaction_date),
                jv_number = COALESCE($2, jv_number),
                year_period = COALESCE($3, year_period),
                batch_number = COALESCE($4, batch_number),
                batch_sequence = COALESCE($5, batch_sequence),
                transaction_type = COALESCE($6, transaction_type),
                type_sequence = COALESCE($7, type_sequence),
                account_number = COALESCE($8, account_number),
                auxiliary_account = COALESCE($9, auxiliary_account),
                account_name = COALESCE($10, account_name),
                cc2 = COALESCE($11, cc2),
                shipment = COALESCE($12, shipment),
                doc_ref = COALESCE($13, doc_ref),
                doc_date = COALESCE($14, doc_date),
                m_classification = COALESCE($15, m_classification),
                description = COALESCE($16, description),
                debit_credit = COALESCE($17, debit_credit),
                currency_code = COALESCE($18, currency_code),
                foreign_amount = COALESCE($19, foreign_amount),
                aed_amount = COALESCE($20, aed_amount),
                usd_amount = COALESCE($21, usd_amount),
                is_pending = COALESCE($22, is_pending),
                is_locked = COALESCE($23, is_locked),
                updated_by = COALESCE($24, updated_by),
                updated_on = CURRENT_TIMESTAMP
            WHERE id = $25
            RETURNING *
        `, [
            transaction_date, jv_number, year_period, batch_number, batch_sequence,
            transaction_type, type_sequence, account_number, auxiliary_account, account_name,
            cc2, shipment, doc_ref, doc_date, m_classification, description, debit_credit,
            currency_code, foreign_amount, aed_amount, usd_amount, is_pending, is_locked,
            updated_by || 'USER', req.params.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Entry not found' });
        }

        res.json({ 
            success: true, 
            message: 'Entry updated successfully', 
            data: result.rows[0] 
        });

    } catch (error) {
        console.error('Error updating entry:', error.message);
        res.status(500).json({ success: false, message: 'Error updating entry', error: error.message });
    }
});

//////////////MIS 

// =====================================================
// ADD THESE COMPLETE ROUTES TO YOUR backend/server.js
// P&L REPORT API ROUTES - COMPLETE VERSION
// =====================================================

// P&L Report Summary API - Current Month Only (Actual)
app.get('/api/reports/pl-summary/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        console.log(`📊 Generating P&L summary for ${year}-${month}...`);
        
        // Specific revenue accounts only
        const revenueAccounts = [
            '42', '4102', '4103', '4104', '4105', '4109', '4201', 
            '410101', '410102', '410103', '410104', '410105', '410106', '410107',
            '410201', '410202', '410203', '410204', '410205', '410206', '410207', '410208', '410209',
            '410301', '410401', '410501', '410502', '410503', '410901',
            '419', '419001', '419002'
        ];
        
        // Get revenue accounts - ONLY specific accounts
        const revenueQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'D' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number = ANY($3)
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) = $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'D' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Get cost accounts (5xxxx) - unchanged
        const costsQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number LIKE '5%'
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) = $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Get expense accounts (6xxxx) - unchanged
        const expensesQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number LIKE '6%'
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) = $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Execute all queries
        const [revenueResult, costsResult, expensesResult] = await Promise.all([
            queryDB(revenueQuery, [year, month, revenueAccounts]),
            queryDB(costsQuery, [year, month]),
            queryDB(expensesQuery, [year, month])
        ]);

        // Calculate totals
        const revenueTotals = revenueResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);
        const costsTotals = costsResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);
        const expensesTotals = expensesResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);

        const grossProfit = revenueTotals - costsTotals;
        const netProfit = grossProfit - expensesTotals;

        console.log(`✅ P&L Summary - Revenue: ${revenueTotals}, Costs: ${costsTotals}, Expenses: ${expensesTotals}`);
        
        res.json({
            success: true,
            data: {
                period: `${year}-${String(month).padStart(2, '0')}`,
                revenue: {
                    accounts: revenueResult.rows,
                    total: revenueTotals
                },
                directCosts: {
                    accounts: costsResult.rows,
                    total: costsTotals
                },
                expenses: {
                    accounts: expensesResult.rows,
                    total: expensesTotals
                },
                grossProfit: grossProfit,
                netProfit: netProfit,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error generating P&L summary:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error generating P&L summary',
            error: error.message
        });
    }
});

// P&L Report Cumulative Data API (Jan to Current Month)
app.get('/api/reports/pl-cumulative/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        console.log(`📊 Generating cumulative P&L data for ${year} Jan-${month}...`);
        
        // Specific revenue accounts only
        const revenueAccounts = [
            '42', '4102', '4103', '4104', '4105', '4109', '4201', 
            '410101', '410102', '410103', '410104', '410105', '410106', '410107',
            '410201', '410202', '410203', '410204', '410205', '410206', '410207', '410208', '410209',
            '410301', '410401', '410501', '410502', '410503', '410901',
            '419', '419001', '419002'
        ];
        
        // Get revenue accounts cumulative - ONLY specific accounts
        const revenueQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'D' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number = ANY($3)
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) <= $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'D' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Get cost accounts cumulative (5xxxx) - unchanged
        const costsQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number LIKE '5%'
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) <= $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Get expense accounts cumulative (6xxxx) - unchanged
        const expensesQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number LIKE '6%'
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) <= $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Execute all queries
        const [revenueResult, costsResult, expensesResult] = await Promise.all([
            queryDB(revenueQuery, [year, month, revenueAccounts]),
            queryDB(costsQuery, [year, month]),
            queryDB(expensesQuery, [year, month])
        ]);

        // Calculate totals
        const revenueTotals = revenueResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);
        const costsTotals = costsResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);
        const expensesTotals = expensesResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);

        const grossProfit = revenueTotals - costsTotals;
        const netProfit = grossProfit - expensesTotals;

        console.log(`✅ Cumulative P&L - Revenue: ${revenueTotals}, Costs: ${costsTotals}, Expenses: ${expensesTotals}`);
        
        res.json({
            success: true,
            data: {
                period: `${year}-01 to ${year}-${String(month).padStart(2, '0')}`,
                revenue: {
                    accounts: revenueResult.rows,
                    total: revenueTotals
                },
                directCosts: {
                    accounts: costsResult.rows,
                    total: costsTotals
                },
                expenses: {
                    accounts: expensesResult.rows,
                    total: expensesTotals
                },
                grossProfit: grossProfit,
                netProfit: netProfit,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error generating cumulative P&L data:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error generating cumulative P&L data',
            error: error.message
        });
    }
});

// P&L Report Previous Period Data API (Jan to Previous Month)
app.get('/api/reports/pl-previous/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        const previousMonth = month > 1 ? month - 1 : 12;
        const previousYear = month > 1 ? year : year - 1;
        
        console.log(`📊 Generating previous P&L data for ${previousYear} Jan-${previousMonth}...`);
        
        // Specific revenue accounts only
        const revenueAccounts = [
            '42', '4102', '4103', '4104', '4105', '4109', '4201', 
            '410101', '410102', '410103', '410104', '410105', '410106', '410107',
            '410201', '410202', '410203', '410204', '410205', '410206', '410207', '410208', '410209',
            '410301', '410401', '410501', '410502', '410503', '410901',
            '419', '419001', '419002'
        ];
        
        // Get revenue accounts previous period - ONLY specific accounts
        const revenueQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'D' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number = ANY($3)
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) <= $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'D' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Get cost accounts previous period (5xxxx) - unchanged
        const costsQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number LIKE '5%'
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) <= $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Get expense accounts previous period (6xxxx) - unchanged
        const expensesQuery = `
            SELECT 
                gl.account_number,
                coa.name as account_name,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as credits,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                         ELSE 0 END) as net_amount
            FROM general_ledger gl
            JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE gl.account_number LIKE '6%'
              AND EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) <= $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            WHEN gl.debit_credit = 'C' THEN -COALESCE(gl.aed_amount, gl.foreign_amount, 0) 
                            ELSE 0 END) != 0
            ORDER BY gl.account_number
        `;

        // Execute all queries
        const [revenueResult, costsResult, expensesResult] = await Promise.all([
            queryDB(revenueQuery, [previousYear, previousMonth, revenueAccounts]),
            queryDB(costsQuery, [previousYear, previousMonth]),
            queryDB(expensesQuery, [previousYear, previousMonth])
        ]);

        // Calculate totals
        const revenueTotals = revenueResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);
        const costsTotals = costsResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);
        const expensesTotals = expensesResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0);

        const grossProfit = revenueTotals - costsTotals;
        const netProfit = grossProfit - expensesTotals;

        console.log(`✅ Previous P&L - Revenue: ${revenueTotals}, Costs: ${costsTotals}, Expenses: ${expensesTotals}`);
        
        res.json({
            success: true,
            data: {
                period: `${previousYear}-01 to ${previousYear}-${String(previousMonth).padStart(2, '0')}`,
                revenue: {
                    accounts: revenueResult.rows,
                    total: revenueTotals
                },
                directCosts: {
                    accounts: costsResult.rows,
                    total: costsTotals
                },
                expenses: {
                    accounts: expensesResult.rows,
                    total: expensesTotals
                },
                grossProfit: grossProfit,
                netProfit: netProfit,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error generating previous P&L data:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error generating previous P&L data',
            error: error.message
        });
    }
});



// =====================================================
// COMPLETE P&L REPORT API WITH ALL ACCOUNT MAPPINGS
// Add this to your existing backend/server.js
// Replace the existing pl-complete route
// =====================================================

// =====================================================
// COMPLETE P&L REPORT API WITH ALL ACCOUNT MAPPINGS
// Add this to your existing backend/server.js
// Replace the existing pl-complete route
// =====================================================

app.get('/api/reports/pl-complete/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        console.log(`📊 Generating COMPLETE P&L summary for ${year}-${month}...`);
        
        // COMPLETE Account mappings for ALL categories
        const accountMappings = {
            // REVENUE accounts - Specific accounts only
            revenue: [
                '42', '4102', '4103', '4104', '4105', '4109', '4201', 
                '410101', '410102', '410103', '410104', '410105', '410106', '410107',
                '410201', '410202', '410203', '410204', '410205', '410206', '410207', '410208', '410209',
                '410301', '410401', '410501', '410502', '410503', '410901',
                '419', '419001', '419002'
            ],
            
            // DIRECT COST specific account mappings
            directPayroll: ['520101'], // Only this account for Direct Payroll
            
            // Materials - all the accounts you listed
            materials: [
                '510101', '510109', '510110', '510201', '510206', '510207', '510208', '510301'
            ],
            
            // Subcontractor Charges
            subcontractorCharges: [
                '510102', '510202', '510302'
            ],
            
            // Transportation & Fuel
            transportationFuel: [
                '520201', '520202', '520208', '520209'
            ],
            
            // Freight and Custom Duty
            freightCustomDuty: ['520204'],
            
            // Provision for Employees End of Service Benefits-Direct
            provisionEmployees: [
                '520210'
            ],
            
            // Depreciation on Property and Equipment (Projects)-Direct
            depreciation: [
                '652601', '652605', '652611'
            ],
            
            // Other Direct Expenses
            otherDirectExpenses: [
                '510104', '510105', '510106', '510107', '510204', '510205', 
                '520103', '520104', '520203', '520207', '520212'
            ],
            
            // Rental Labors
            rentalLabors: [
                '510103', '510203', '510303'
            ],
            
            // Work in Progress
            workInProgress: [
                '510108'
            ],
            
            // ======================================
            // GENERAL & ADMINISTRATIVE EXPENSES
            // ======================================
            
            // Indirect Payroll
            indirectPayroll: [
                '520102'
            ],
            
            // Other Administration Expenses - REMOVE ACCOUNTS (will be calculated as sum)
            otherAdminExpenses: [],
            
            // Employees Allowances (Leave Salaries,Accom,EOS,Car,Bonus)
            employeesAllowances: [
                '6101', '610101', '610102', '610103', '610104', '610105', 
                '610108', '610110', '610503', '610504', '610506', 
                '63', '6301', '630101', '630110', '630201', '630301'
            ],
            
            // Motor Vehicle Petrol and Maintenance
            motorVehicle: [
                '6504', '650401', '650402', '650403', '650404', '650405', 
                '650406', '650407', '650408', '650409', '650410', '650411'
            ],
            
            // Professional and Government Fees
            professionalFees: [
                '6508', '650801', '650806', '650807', '650808', '650809', 
                '6509', '650901', '650902', '650903'
            ],
            
            // Licenses and Visa Fees
            licensesVisaFees: [
                '650802', '650803', '650804', '6510', '651001', 
                '6511', '651101', '651102', '651103', '651104', '651105', '651106'
            ],
            
            // Rent
            rent: [
                '520211', '610502', '6501', '650101', '650102', '650103', 
                '650104', '650105', '650106', '650107', '650108', '650109', '65025'
            ],
            
            // Marketing (Clients Inquiries and Tender Costs)
            marketing: [
                '6520', '652001', '652002', '652003', '652004', '652005', 
                '652006', '652007', '652008', '652009', '6523', '652301', '652302'
            ],
            
            // Insurance
            insurance: [
                '6518', '651801', '651802', '651803', '651804', '651805', '651806', '651810'
            ],
            
            // Travel & Entertainment (Tickets)
            travelEntertainment: [
                '6506', '650602', '650603', '650605', '650610', 
                '6507', '650701', '650702', '650706'
            ],
            
            // Telephone
            telephone: [
                '6503', '650301', '650302'
            ],
            
            // Depreciation of Property and Equipment-Indirect - CORRECTED ACCOUNTS
            depreciationIndirect: [
                '652602', '652603', '652604', '652606', '652607', '652608', '652609', '652610', '652612', '6527', '652701'
            ],
            
            // Printing & Stationery
            printingStationery: [
                '651501', '651508'
            ],
            
            // Electricity & Water
            electricityWater: [
                '6502', '650201', '650202', '650203'
            ],
            
            // Office Supplies
            officeSupplies: [
                '651502', '651503', '651504', '651505', '651506', '651507'
            ],
            
            // Depreciation of Right to use asset
            depreciationRightToUse: [
                '652608'
            ],
            
            // Repairs & Maintenance & Uniforms & IT
            repairsMaintenance: [
                '6505', '650501', '650502', '650503', '650504', '650509', '650805',
                '6513', '651301', '651302', '651303', 
                '6514', '651401', '651402', '651403', '652303'
            ],
            
            // Prov for Employees End of Service Benefits-Indirect
            provisionEmployeesIndirect: [
                '610106', '610505'
            ],
            
            // Other General & Admin Expenses (same as Other Administration Expenses)
            otherGeneralAdmin: [
                '6524', '652401', '652402', '6528', '652801', '6529', 
                '652901', '652902', '6530', '653001', '690101', '999999'
            ],
            
            // Impairment of Trade Receivables
            impairmentTradeReceivables: [
                '6519', '651901', '651902'
            ],
            
            // Impairment of Retention Receivables - KEEP BLANK (no accounts mapped)
            impairmentRetentionReceivables: [],
            
            // Loss on Liquidated Bank Guarantees (no accounts mapped - blank)
            lossLiquidatedBankGuarantees: [],
            
            // ======================================
            // OTHER INCOME/EXPENSES
            // ======================================
            
            // Borrowings Costs
            borrowingsCosts: [
                '520205', '520206', '610107', '6525', '652501', '652502', '652503', '652504'
            ],
            
            // Other Income
            otherIncome: [
                '43', '4301', '430101', '45', '4501', '450101', 
                '47', '4701', '470101', '470102', '6531', '653101'
            ]
        };

        const previousMonth = month > 1 ? month - 1 : 12;
        const previousYear = month > 1 ? year : year - 1;

        // Helper function to get category totals for specific accounts
        async function getCategoryTotals(yearParam, monthCondition, accounts) {
    if (!accounts || accounts.length === 0) {
        return { total_credits: 0, total_debits: 0, transaction_count: 0 };
    }
    
    const whereClause = `
        WHERE gl.account_number = ANY($2)
        AND EXTRACT(YEAR FROM gl.transaction_date) = $1 
        ${monthCondition} 
        AND gl.is_locked = false
    `;
    
    const query = `
        SELECT 
            SUM(CASE 
                WHEN gl.debit_credit = 'C' THEN 
                    CASE 
                        WHEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) < 0 
                        THEN ABS(COALESCE(gl.aed_amount, gl.foreign_amount, 0))
                        ELSE COALESCE(gl.aed_amount, gl.foreign_amount, 0)
                    END 
                ELSE 0 
            END) as total_credits,
            SUM(CASE 
                WHEN gl.debit_credit = 'D' THEN 
                    CASE 
                        WHEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) < 0 
                        THEN ABS(COALESCE(gl.aed_amount, gl.foreign_amount, 0))
                        ELSE COALESCE(gl.aed_amount, gl.foreign_amount, 0)
                    END 
                ELSE 0 
            END) as total_debits,
            COUNT(*) as transaction_count
        FROM general_ledger gl
        JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
        ${whereClause}
    `;
    
    console.log(`🔍 Query for ${JSON.stringify(accounts.slice(0, 5))}... (${accounts.length} accounts)`);
    
    const result = await queryDB(query, [yearParam, accounts]);
    const row = result.rows[0] || { total_credits: 0, total_debits: 0, transaction_count: 0 };
    
    console.log(`📊 Results: Credits=${row.total_credits}, Debits=${row.total_debits}, Count=${row.transaction_count}`);
    
    return row;
}

        // Get all data in parallel
        console.log('🔄 Fetching data for ALL categories...');
        
        const [
            // ACTUAL (Current month only)
            revenueActual, directPayrollActual, materialsActual, subcontractorActual, 
            transportationActual, freightActual, provisionActual, depreciationActual, 
            otherDirectActual, rentalActual, wipActual,
            
            // General & Administrative Expenses - ACTUAL
            indirectPayrollActual, otherAdminActual, employeesAllowancesActual,
            motorVehicleActual, professionalFeesActual, licensesVisaActual,
            rentActual, marketingActual, insuranceActual, travelActual,
            telephoneActual, depreciationIndirectActual, printingActual,
            electricityActual, officeSuppliesActual, depreciationRightActual,
            repairsMaintenanceActual, provisionIndirectActual, otherGeneralActual,
            impairmentTradeActual, impairmentRetentionActual, lossGuaranteesActual,
            
            // Other Income/Expenses - ACTUAL
            borrowingsCostsActual, otherIncomeActual,
            
            // CUMULATIVE (Jan to current month)
            revenueCumulative, directPayrollCumulative, materialsCumulative, subcontractorCumulative,
            transportationCumulative, freightCumulative, provisionCumulative, depreciationCumulative,
            otherDirectCumulative, rentalCumulative, wipCumulative,
            
            // General & Administrative Expenses - CUMULATIVE
            indirectPayrollCumulative, otherAdminCumulative, employeesAllowancesCumulative,
            motorVehicleCumulative, professionalFeesCumulative, licensesVisaCumulative,
            rentCumulative, marketingCumulative, insuranceCumulative, travelCumulative,
            telephoneCumulative, depreciationIndirectCumulative, printingCumulative,
            electricityCumulative, officeSuppliesCumulative, depreciationRightCumulative,
            repairsMaintenanceCumulative, provisionIndirectCumulative, otherGeneralCumulative,
            impairmentTradeCumulative, impairmentRetentionCumulative, lossGuaranteesCumulative,
            
            // Other Income/Expenses - CUMULATIVE
            borrowingsCostsCumulative, otherIncomeCumulative,
            
            // PREVIOUS (Jan to previous month)
            revenuePrevious, directPayrollPrevious, materialsPrevious, subcontractorPrevious,
            transportationPrevious, freightPrevious, provisionPrevious, depreciationPrevious,
            otherDirectPrevious, rentalPrevious, wipPrevious,
            
            // General & Administrative Expenses - PREVIOUS
            indirectPayrollPrevious, otherAdminPrevious, employeesAllowancesPrevious,
            motorVehiclePrevious, professionalFeesPrevious, licensesVisaPrevious,
            rentPrevious, marketingPrevious, insurancePrevious, travelPrevious,
            telephonePrevious, depreciationIndirectPrevious, printingPrevious,
            electricityPrevious, officeSuppliesPrevious, depreciationRightPrevious,
            repairsMaintenancePrevious, provisionIndirectPrevious, otherGeneralPrevious,
            impairmentTradePrevious, impairmentRetentionPrevious, lossGuaranteesPrevious,
            
            // Other Income/Expenses - PREVIOUS
            borrowingsCostsPrevious, otherIncomePrevious
            
        ] = await Promise.all([
            // ACTUAL (Current month)
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.revenue),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.directPayroll),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.materials),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.subcontractorCharges),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.transportationFuel),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.freightCustomDuty),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.provisionEmployees),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.depreciation),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.otherDirectExpenses),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.rentalLabors),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.workInProgress),
            
            // G&A Expenses - ACTUAL
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.indirectPayroll),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.otherAdminExpenses),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.employeesAllowances),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.motorVehicle),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.professionalFees),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.licensesVisaFees),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.rent),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.marketing),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.insurance),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.travelEntertainment),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.telephone),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.depreciationIndirect),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.printingStationery),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.electricityWater),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.officeSupplies),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.depreciationRightToUse),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.repairsMaintenance),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.provisionEmployeesIndirect),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.otherGeneralAdmin),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.impairmentTradeReceivables),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.impairmentRetentionReceivables),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.lossLiquidatedBankGuarantees),
            
            // Other Income/Expenses - ACTUAL
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.borrowingsCosts),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, accountMappings.otherIncome),
            
            // CUMULATIVE (Jan to current month) - ALL CATEGORIES
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.revenue),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.directPayroll),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.materials),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.subcontractorCharges),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.transportationFuel),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.freightCustomDuty),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.provisionEmployees),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.depreciation),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.otherDirectExpenses),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.rentalLabors),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.workInProgress),
            
            // G&A Expenses - CUMULATIVE
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.indirectPayroll),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.otherAdminExpenses),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.employeesAllowances),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.motorVehicle),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.professionalFees),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.licensesVisaFees),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.rent),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.marketing),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.insurance),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.travelEntertainment),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.telephone),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.depreciationIndirect),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.printingStationery),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.electricityWater),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.officeSupplies),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.depreciationRightToUse),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.repairsMaintenance),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.provisionEmployeesIndirect),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.otherGeneralAdmin),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.impairmentTradeReceivables),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.impairmentRetentionReceivables),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.lossLiquidatedBankGuarantees),
            
            // Other Income/Expenses - CUMULATIVE
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.borrowingsCosts),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, accountMappings.otherIncome),
            
            // PREVIOUS (Jan to previous month) - ALL CATEGORIES
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.revenue),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.directPayroll),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.materials),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.subcontractorCharges),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.transportationFuel),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.freightCustomDuty),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.provisionEmployees),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.depreciation),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.otherDirectExpenses),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.rentalLabors),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.workInProgress),
            
            // G&A Expenses - PREVIOUS
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.indirectPayroll),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.otherAdminExpenses),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.employeesAllowances),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.motorVehicle),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.professionalFees),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.licensesVisaFees),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.rent),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.marketing),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.insurance),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.travelEntertainment),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.telephone),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.depreciationIndirect),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.printingStationery),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.electricityWater),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.officeSupplies),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.depreciationRightToUse),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.repairsMaintenance),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.provisionEmployeesIndirect),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.otherGeneralAdmin),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.impairmentTradeReceivables),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.impairmentRetentionReceivables),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.lossLiquidatedBankGuarantees),
            
            // Other Income/Expenses - PREVIOUS
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.borrowingsCosts),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, accountMappings.otherIncome)
        ]);

        // Calculate net amounts (Revenue: Credit-Debit, Costs/Expenses: Debit-Credit)
        const calculateRevenue = (data) => parseFloat(data.total_credits || 0) - parseFloat(data.total_debits || 0);
        const calculateExpense = (data) => parseFloat(data.total_debits || 0) - parseFloat(data.total_credits || 0);

        // Build response according to complete P&L structure
        const reportData = {
            // REVENUE
            revenue: {
                actual: calculateRevenue(revenueActual),
                cumulative: calculateRevenue(revenueCumulative),
                previous: calculateRevenue(revenuePrevious)
            },
            
            // DIRECT COSTS breakdown with specific accounts
            directPayroll: {
                actual: calculateExpense(directPayrollActual),
                cumulative: calculateExpense(directPayrollCumulative),
                previous: calculateExpense(directPayrollPrevious)
            },
            
            materials: {
                actual: calculateExpense(materialsActual),
                cumulative: calculateExpense(materialsCumulative),
                previous: calculateExpense(materialsPrevious)
            },
            
            subcontractorCharges: {
                actual: calculateExpense(subcontractorActual),
                cumulative: calculateExpense(subcontractorCumulative),
                previous: calculateExpense(subcontractorPrevious)
            },
            
            transportationFuel: {
                actual: calculateExpense(transportationActual),
                cumulative: calculateExpense(transportationCumulative),
                previous: calculateExpense(transportationPrevious)
            },
            
            freightCustomDuty: {
                actual: calculateExpense(freightActual),
                cumulative: calculateExpense(freightCumulative),
                previous: calculateExpense(freightPrevious)
            },
            
            provisionEmployees: {
                actual: calculateExpense(provisionActual),
                cumulative: calculateExpense(provisionCumulative),
                previous: calculateExpense(provisionPrevious)
            },
            
            depreciation: {
                actual: calculateExpense(depreciationActual),
                cumulative: calculateExpense(depreciationCumulative),
                previous: calculateExpense(depreciationPrevious)
            },
            
            otherDirectExpenses: {
                actual: calculateExpense(otherDirectActual),
                cumulative: calculateExpense(otherDirectCumulative),
                previous: calculateExpense(otherDirectPrevious)
            },
            
            rentalLabors: {
                actual: calculateExpense(rentalActual),
                cumulative: calculateExpense(rentalCumulative),
                previous: calculateExpense(rentalPrevious)
            },
            
            workInProgress: {
                actual: calculateExpense(wipActual),
                cumulative: calculateExpense(wipCumulative),
                previous: calculateExpense(wipPrevious)
            },
            
            // ======================================
            // GENERAL & ADMINISTRATIVE EXPENSES
            // ======================================
            
            indirectPayroll: {
                actual: calculateExpense(indirectPayrollActual),
                cumulative: calculateExpense(indirectPayrollCumulative),
                previous: calculateExpense(indirectPayrollPrevious)
            },
            
            otherAdminExpenses: {
                actual: calculateExpense(otherAdminActual),
                cumulative: calculateExpense(otherAdminCumulative),
                previous: calculateExpense(otherAdminPrevious)
            },
            
            employeesAllowances: {
                actual: calculateExpense(employeesAllowancesActual),
                cumulative: calculateExpense(employeesAllowancesCumulative),
                previous: calculateExpense(employeesAllowancesPrevious)
            },
            
            motorVehicle: {
                actual: calculateExpense(motorVehicleActual),
                cumulative: calculateExpense(motorVehicleCumulative),
                previous: calculateExpense(motorVehiclePrevious)
            },
            
            professionalFees: {
                actual: calculateExpense(professionalFeesActual),
                cumulative: calculateExpense(professionalFeesCumulative),
                previous: calculateExpense(professionalFeesPrevious)
            },
            
            licensesVisaFees: {
                actual: calculateExpense(licensesVisaActual),
                cumulative: calculateExpense(licensesVisaCumulative),
                previous: calculateExpense(licensesVisaPrevious)
            },
            
            rent: {
                actual: calculateExpense(rentActual),
                cumulative: calculateExpense(rentCumulative),
                previous: calculateExpense(rentPrevious)
            },
            
            marketing: {
                actual: calculateExpense(marketingActual),
                cumulative: calculateExpense(marketingCumulative),
                previous: calculateExpense(marketingPrevious)
            },
            
            insurance: {
                actual: calculateExpense(insuranceActual),
                cumulative: calculateExpense(insuranceCumulative),
                previous: calculateExpense(insurancePrevious)
            },
            
            travelEntertainment: {
                actual: calculateExpense(travelActual),
                cumulative: calculateExpense(travelCumulative),
                previous: calculateExpense(travelPrevious)
            },
            
            telephone: {
                actual: calculateExpense(telephoneActual),
                cumulative: calculateExpense(telephoneCumulative),
                previous: calculateExpense(telephonePrevious)
            },
            
            depreciationIndirect: {
                actual: calculateExpense(depreciationIndirectActual),
                cumulative: calculateExpense(depreciationIndirectCumulative),
                previous: calculateExpense(depreciationIndirectPrevious)
            },
            
            printingStationery: {
                actual: calculateExpense(printingActual),
                cumulative: calculateExpense(printingCumulative),
                previous: calculateExpense(printingPrevious)
            },
            
            electricityWater: {
                actual: calculateExpense(electricityActual),
                cumulative: calculateExpense(electricityCumulative),
                previous: calculateExpense(electricityPrevious)
            },
            
            officeSupplies: {
                actual: calculateExpense(officeSuppliesActual),
                cumulative: calculateExpense(officeSuppliesCumulative),
                previous: calculateExpense(officeSuppliesPrevious)
            },
            
            depreciationRightToUse: {
                actual: calculateExpense(depreciationRightActual),
                cumulative: calculateExpense(depreciationRightCumulative),
                previous: calculateExpense(depreciationRightPrevious)
            },
            
            repairsMaintenance: {
                actual: calculateExpense(repairsMaintenanceActual),
                cumulative: calculateExpense(repairsMaintenanceCumulative),
                previous: calculateExpense(repairsMaintenancePrevious)
            },
            
            provisionEmployeesIndirect: {
                actual: calculateExpense(provisionIndirectActual),
                cumulative: calculateExpense(provisionIndirectCumulative),
                previous: calculateExpense(provisionIndirectPrevious)
            },
            
            otherGeneralAdmin: {
                actual: calculateExpense(otherGeneralActual),
                cumulative: calculateExpense(otherGeneralCumulative),
                previous: calculateExpense(otherGeneralPrevious)
            },
            
            impairmentTradeReceivables: {
                actual: calculateExpense(impairmentTradeActual),
                cumulative: calculateExpense(impairmentTradeCumulative),
                previous: calculateExpense(impairmentTradePrevious)
            },
            
            impairmentRetentionReceivables: {
                actual: calculateExpense(impairmentRetentionActual),
                cumulative: calculateExpense(impairmentRetentionCumulative),
                previous: calculateExpense(impairmentRetentionPrevious)
            },
            
            lossLiquidatedBankGuarantees: {
                actual: calculateExpense(lossGuaranteesActual),
                cumulative: calculateExpense(lossGuaranteesCumulative),
                previous: calculateExpense(lossGuaranteesPrevious)
            },
            
            // ======================================
            // OTHER INCOME/EXPENSES
            // ======================================
            
            borrowingsCosts: {
                actual: calculateExpense(borrowingsCostsActual),
                cumulative: calculateExpense(borrowingsCostsCumulative),
                previous: calculateExpense(borrowingsCostsPrevious)
            },
            
            otherIncome: {
                actual: calculateRevenue(otherIncomeActual), // Income = Credit - Debit
                cumulative: calculateRevenue(otherIncomeCumulative),
                previous: calculateRevenue(otherIncomePrevious)
            }
        };

        // Calculate DIRECT EXPENSES = Materials + Subcontractor + Transportation + Freight + Provision + Depreciation + Other + Rental + WIP
        const directExpenseCategories = [
            'materials', 'subcontractorCharges', 'transportationFuel', 'freightCustomDuty',
            'provisionEmployees', 'depreciation', 'otherDirectExpenses', 'rentalLabors', 'workInProgress'
        ];

        reportData.directExpenses = {
            actual: directExpenseCategories.reduce((sum, cat) => sum + reportData[cat].actual, 0),
            cumulative: directExpenseCategories.reduce((sum, cat) => sum + reportData[cat].cumulative, 0),
            previous: directExpenseCategories.reduce((sum, cat) => sum + reportData[cat].previous, 0)
        };

        // Calculate TOTAL DIRECT COST = Direct Payroll + Direct Expenses
        reportData.totalDirectCost = {
            actual: reportData.directPayroll.actual + reportData.directExpenses.actual,
            cumulative: reportData.directPayroll.cumulative + reportData.directExpenses.cumulative,
            previous: reportData.directPayroll.previous + reportData.directExpenses.previous
        };

        // Calculate TOTAL GROSS PROFIT = Revenue - Total Direct Cost
        reportData.grossProfit = {
            actual: reportData.revenue.actual - reportData.totalDirectCost.actual,
            cumulative: reportData.revenue.cumulative - reportData.totalDirectCost.cumulative,
            previous: reportData.revenue.previous - reportData.totalDirectCost.previous
        };

        // Calculate TOTAL GENERAL & ADMINISTRATIVE EXPENSES = Indirect Payroll + Other Administration Expenses + Impairment of Trade Receivables
        const otherAdminExpenseCategories = [
            'employeesAllowances', 'motorVehicle', 'professionalFees', 'licensesVisaFees', 'rent', 
            'marketing', 'insurance', 'travelEntertainment', 'telephone', 'depreciationIndirect', 
            'printingStationery', 'electricityWater', 'officeSupplies', 'depreciationRightToUse', 
            'repairsMaintenance', 'provisionEmployeesIndirect', 'otherGeneralAdmin'
        ];

        // Calculate Other Administration Expenses (sum of all individual categories)
        reportData.otherAdminExpenses = {
            actual: otherAdminExpenseCategories.reduce((sum, cat) => sum + reportData[cat].actual, 0),
            cumulative: otherAdminExpenseCategories.reduce((sum, cat) => sum + reportData[cat].cumulative, 0),
            previous: otherAdminExpenseCategories.reduce((sum, cat) => sum + reportData[cat].previous, 0)
        };

        // Calculate TOTAL GENERAL & ADMINISTRATIVE EXPENSES = Indirect Payroll + Other Administration Expenses + Impairment of Trade Receivables
        reportData.totalGeneralAdmin = {
            actual: reportData.indirectPayroll.actual + reportData.otherAdminExpenses.actual + reportData.impairmentTradeReceivables.actual,
            cumulative: reportData.indirectPayroll.cumulative + reportData.otherAdminExpenses.cumulative + reportData.impairmentTradeReceivables.cumulative,
            previous: reportData.indirectPayroll.previous + reportData.otherAdminExpenses.previous + reportData.impairmentTradeReceivables.previous
        };

        // Calculate TOTAL OPERATING PROFIT = Gross Profit - Total General & Administrative Expenses
        reportData.totalOperatingProfit = {
            actual: reportData.grossProfit.actual - reportData.totalGeneralAdmin.actual,
            cumulative: reportData.grossProfit.cumulative - reportData.totalGeneralAdmin.cumulative,
            previous: reportData.grossProfit.previous - reportData.totalGeneralAdmin.previous
        };

        // Calculate NET PROFIT = Operating Profit - Borrowings Costs + Other Income
        reportData.netProfit = {
            actual: reportData.totalOperatingProfit.actual - reportData.borrowingsCosts.actual + reportData.otherIncome.actual,
            cumulative: reportData.totalOperatingProfit.cumulative - reportData.borrowingsCosts.cumulative + reportData.otherIncome.cumulative,
            previous: reportData.totalOperatingProfit.previous - reportData.borrowingsCosts.previous + reportData.otherIncome.previous
        };

        // Add headcount data (placeholder - will need separate mapping)
        reportData.directHeadcount = { actual: 0, cumulative: 0, previous: 0 };
        reportData.indirectHeadcount = { actual: 0, cumulative: 0, previous: 0 };
        reportData.totalHeadcount = { actual: 0, cumulative: 0, previous: 0 };

        console.log(`✅ COMPLETE P&L Summary Generated:`);
        console.log(`Revenue: ${reportData.revenue.actual} | ${reportData.revenue.cumulative} | ${reportData.revenue.previous}`);
        console.log(`Direct Payroll: ${reportData.directPayroll.actual} | ${reportData.directPayroll.cumulative} | ${reportData.directPayroll.previous}`);
        console.log(`Gross Profit: ${reportData.grossProfit.actual} | ${reportData.grossProfit.cumulative} | ${reportData.grossProfit.previous}`);
        console.log(`Total G&A: ${reportData.totalGeneralAdmin.actual} | ${reportData.totalGeneralAdmin.cumulative} | ${reportData.totalGeneralAdmin.previous}`);
        console.log(`Operating Profit: ${reportData.totalOperatingProfit.actual} | ${reportData.totalOperatingProfit.cumulative} | ${reportData.totalOperatingProfit.previous}`);
        console.log(`Net Profit: ${reportData.netProfit.actual} | ${reportData.netProfit.cumulative} | ${reportData.netProfit.previous}`);


        // ADD THIS CODE TO YOUR EXISTING PL-COMPLETE ROUTE - BEFORE res.json()

try {
    // Fetch budget data for the selected month
    console.log('🎯 Fetching budget data for P&L report...');
    
    const budgetResponse = await fetch(`http://localhost:${PORT}/api/budget/${year}/${month}`);
    const budgetResult = await budgetResponse.json();
    
    let budgetData = {};
    if (budgetResult.success) {
        budgetData = budgetResult.data;
        console.log('✅ Budget data integrated successfully');
    } else {
        console.log('⚠️ No budget data found, using zeros');
    }
    
    // Add budget amounts to each category in reportData
    Object.keys(reportData).forEach(key => {
        if (reportData[key] && typeof reportData[key] === 'object' && reportData[key].actual !== undefined) {
            // Map P&L categories to budget table names
            const budgetKey = getBudgetKey(key);
            reportData[key].budget = budgetData[budgetKey] ? budgetData[budgetKey].amount : 0;
        }
    });
    
} catch (budgetError) {
    console.error('❌ Error fetching budget data:', budgetError);
    // Continue without budget data
    Object.keys(reportData).forEach(key => {
        if (reportData[key] && typeof reportData[key] === 'object' && reportData[key].actual !== undefined) {
            reportData[key].budget = 0;
        }
    });
}

// Helper function to map P&L categories to budget table particular_names
function getBudgetKey(plKey) {
    const budgetMapping = {
        'revenue': 'REVENUE',
        'directPayroll': 'Direct Payroll', 
        'directExpenses': 'Direct Expenses',
        'materials': 'Materials',
        'subcontractorCharges': 'Subcontractor Charges',
        'transportationFuel': 'Transportation & Fuel',
        'freightCustomDuty': 'Freight And Custom Duty',
        'provisionEmployees': 'Prov for Employees End of Service Benefits-Direct',
        'depreciation': 'Dep on Property and Equipment (Projects)-Direct',
        'otherDirectExpenses': 'Other Direct Expenses',
        'rentalLabors': 'Rental Labors',
        'workInProgress': 'Work In Progress',
        'totalDirectCost': 'TOTAL DIRECT COST',
        'grossProfit': 'TOTAL GROSS PROFIT',
        'indirectPayroll': 'INDIRECT PAYROLL',
        'otherAdminExpenses': 'OTHER ADMINISTRATION EXPENSES',
        'employeesAllowances': 'Employees Allowances (Leave Salaries,Accom,EOS,Car,Bonus)',
        'motorVehicle': 'Motor Vehicle Petrol And Maintenance',
        'professionalFees': 'Professional And Government Fees',
        'licensesVisaFees': 'Licenses And Visa Fees',
        'rent': 'Rent',
        'marketing': 'Marketing (Clients Inquiries and Tender Costs)',
        'insurance': 'Insurance',
        'travelEntertainment': 'Travel & Entertainment (Tickets)',
        'telephone': 'Telephone',
        'depreciationIndirect': 'Depreciation of Property and Equipment-Indirect',
        'printingStationery': 'Printing & Stationery',
        'electricityWater': 'Electricity & Water',
        'officeSupplies': 'Office Supplies',
        'depreciationRightToUse': 'Depreciation of Right to use asset',
        'repairsMaintenance': 'Repairs & Maintenance & Uniforms & IT',
        'provisionEmployeesIndirect': 'Prov For Employees End Of Service Benefits-Indirect',
        'otherGeneralAdmin': 'Other General & Admin Expenses',
        'impairmentTradeReceivables': 'Impairment Of Trade Receivables',
        'impairmentRetentionReceivables': 'Impairment Of Retention Receivables',
        'lossLiquidatedBankGuarantees': 'Loss on liquidated bank guarantees',
        'totalGeneralAdmin': 'TOTAL GENERAL & ADMINISTRATIVE EXPENSES',
        'totalOperatingProfit': 'TOTAL OPERATING PROFIT',
        'borrowingsCosts': 'BORROWINGS COSTS',
        'otherIncome': 'OTHER INCOME',
        'netProfit': 'TOTAL NET PROFIT FOR THE YEAR',
        'directHeadcount': 'Direct Headcount',
        'indirectHeadcount': 'Indirect Headcount'
    };
    
    return budgetMapping[plKey] || plKey;
}

        res.json({
            success: true,
            data: reportData,
            period: `${year}-${String(month).padStart(2, '0')}`,
            accountMappings: accountMappings, // Include mappings for reference
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error generating COMPLETE P&L summary:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error generating P&L summary',
            error: error.message
        });
    }
});



//////////////////////// ASSET MANAGEMENT REPORTS ////////////////////////

// =====================================================
// COMPLETE ASSETS BACKEND - FIXED RUNNING BALANCE LOGIC
// Replace the entire assets section in your server.js with this
// =====================================================

// Assets Schedule API Route - FIXED with proper year-to-year calculation
app.get('/api/reports/assets-schedule/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const targetYear = parseInt(year);
        console.log(`🏢 Generating Extended Assets Schedule for YEAR ${targetYear}...`);
        
        // COMPLETE ACCOUNT MAPPINGS
        const cashAccounts = {
            pettyCashMain: '110101',
            pettyCashProjects: '110102', 
            pettyCashEmployee: '110103',
            mainCollection: '110111',
            creditCardTransactions: '110112'
        };
        
        const bankAccounts = {
    investBank: { account: '110202', auxiliary: '001' },
    investBankOthers: { account: '110202', auxiliary: 'NOT_001' },
    blomBank: { account: '110210', auxiliary: null },
    adcbPtsAd: { account: '110211', auxiliary: null },
    adcbDubai: { account: '110212', auxiliary: null },
    adcbAccountSaver: { account: '110214', auxiliary: null }, // NEW - ADDED MISSING ACCOUNT
    pemoNymcard: { account: '110213', auxiliary: null }
};

        const marginDepositAccounts = {
            marginPerformanceAdvance: '112108',
            fixedDepositsUnderLien: '112111'
        };

        const tradeReceivablesAccounts = {
    clientsCertifiedWorkks: '111101',        // FIXED - Clients (Certified Works) - 21,920,568
    clientsAdvance: '111115',               // Clients (Advance) - 409,500
    contractWorkInProgress: '111102',       // Contract Work in Progress (WIP) - 0
    clientsNonCollectible: '111113',        // Clients (Non-collectible) - 9,324,149
    clientsIpaUncertified: '111109',        // Clients - IPA (Un-Certified Works) - 27,239,054
    maintenanceClients: '111105',           // Maintenance Clients - 62,146
    loamsClients1: '111111',                // LOAMS-Clients 1 - 3,140,807
    loamsClients2: '111112',                // LOAMS-Clients 2 - 3,140,807
    provImpairmentTrade1: '211850',         // Prov for Impairment 1 - (-4,991,976)
    provImpairmentTrade2: '211851',         // Prov for Impairment 2 - (-4,991,976)
    provImpairmentTrade3: '211853',         // Prov for Impairment 3 - (-4,991,977)
    provImpairmentRetention: '211852'       // Prov for Impairment Retention - (-822,300)
};

        const retentionReceivablesAccounts = {
            retentionCertified1: '111103',
            retentionCertified2: '111114',
            retentionAgainstPB: '111106',
            retentionIpaUncertified: '111110'
        };

        const relatedPartiesAccounts = {
            dueFromAlPhoenician: '112501'
        };

        const inventoryAccounts = {
            inventoryCivilMechanicalTiles: '111104'
        };

        const equipmentAccounts = {
            productionEquipmentCost: '120101',
            productionEquipmentDepn: '120201',
            officeEquipmentCost: '120102',
            officeEquipmentDepn: '120202',
            furnitureFixturesCost: '120103',
            furnitureFixturesDepn: '120203',
            computerSoftwareCost: '120104',
            computerSoftwareDepn: '120204',
            toolsCost: '120105',
            toolsDepn: '120205',
            carsVehiclesCost: '120107',
            carsVehiclesDepn: '120207',
            officeImprovementCost: '120110',
            officeImprovementDepn: '120209', // CORRECTED
            siteAssetsToolsCost1: '120111',
            siteAssetsToolsCost2: '120112',
            siteAssetsToolsCost3: '120113',
            siteAssetsToolsDepn1: '120211',
            siteAssetsToolsDepn2: '120212'

        };

        const rightOfUseAccounts = {
            assetsOffice: '120108',
            officeSpaceDepn: '120208'
        };

        const loansAdvancesAccounts = {
            loansAdvancesSuppliers: '112403',
            othersOverPaidSuppliers: '112404'
        };

        const prepaymentsBreakdownAccounts = {
    rentPrepaidThirdParty: '112341',         // 566,406
    rentPrepaidExpenses: '112351',           // 68,192
    prepaidVisaExpense: '112352',            // 274,750
    otherPrepaidExpenses: '112359'           // 0
};

        const refundableDepositsBreakdownAccounts = {
            staffBankGuarantee: '1122',
            refundableDepositsAccom: '112101',
            dewaFewaEmicoolDeposits: '112103',
            duDeposit: '112107',
            refundableDepositsThirdParty: '112110',
            otherDeposits: '112199'
        };

        const otherReceivablesAccounts = {
    staffLoansAdvancesPaid: '111503',        // Staff Loans and Advances Paid
    otherReceivables: '111503'               // Other Receivables
};

        // Initialize assets data
        const assetsData = {};
        
        // Process cash accounts
        for (const [key, accountNo] of Object.entries(cashAccounts)) {
            console.log(`📊 Processing cash account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }
        
        // Process bank accounts
        for (const [key, config] of Object.entries(bankAccounts)) {
    console.log(`🏦 Processing bank account ${config.account} (${key}) for year ${targetYear}...`);
    assetsData[key] = await getBankYearlyRunningBalances(config.account, config.auxiliary, targetYear);
}

        // Process margin & deposits accounts
        for (const [key, accountNo] of Object.entries(marginDepositAccounts)) {
            console.log(`📊 Processing margin/deposit account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

        // Process trade receivables accounts
        for (const [key, accountNo] of Object.entries(tradeReceivablesAccounts)) {
    console.log(`📊 Processing trade receivables account ${accountNo} (${key}) for year ${targetYear}...`);
    assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
    
    // SPECIAL LOG for account 111101
    if (accountNo === '111101') {
        console.log(`🔍 SPECIAL CHECK - Account 111101 (Clients Certified Works):`);
        console.log(`Opening Balance: ${assetsData[key].dec_prev}`);
        console.log(`Expected: 21920568`);
        console.log(`Match: ${assetsData[key].dec_prev === 21920568 ? 'YES' : 'NO'}`);
    }
}


        // Process retention receivables accounts
        for (const [key, accountNo] of Object.entries(retentionReceivablesAccounts)) {
            console.log(`📊 Processing retention account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

 

        



// Process main prepayments account (the total)
for (const [key, accountNo] of Object.entries(prepaymentsBreakdownAccounts)) {
    console.log(`📄 Processing prepayments account ${accountNo} (${key}) for year ${targetYear}...`);
    assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
}

        // Process related parties accounts
        for (const [key, accountNo] of Object.entries(relatedPartiesAccounts)) {
            console.log(`📊 Processing related parties account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

        // Process inventory accounts
        for (const [key, accountNo] of Object.entries(inventoryAccounts)) {
            console.log(`📦 Processing inventory account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

        // Process equipment accounts  
        for (const [key, accountNo] of Object.entries(equipmentAccounts)) {
            console.log(`🏭 Processing equipment account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

        // Process right of use accounts
        for (const [key, accountNo] of Object.entries(rightOfUseAccounts)) {
            console.log(`🏢 Processing right of use account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

        // Process loans and advances breakdown
        for (const [key, accountNo] of Object.entries(loansAdvancesAccounts)) {
            console.log(`💰 Processing loans/advances account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

        // Process prepayments breakdown
        for (const [key, accountNo] of Object.entries(prepaymentsBreakdownAccounts)) {
            console.log(`📄 Processing prepayments account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

        // Process refundable deposits breakdown
        for (const [key, accountNo] of Object.entries(refundableDepositsBreakdownAccounts)) {
            console.log(`🏦 Processing deposits account ${accountNo} (${key}) for year ${targetYear}...`);
            assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
        }

        // Process other receivables
        for (const [key, accountNo] of Object.entries(otherReceivablesAccounts)) {
    console.log(`📋 Processing other receivables account ${accountNo} (${key}) for year ${targetYear}...`);
    assetsData[key] = await getYearlyRunningBalances(accountNo, targetYear);
}

        // CALCULATE ALL TOTALS
        
        // Cash totals
        assetsData.cashTotal = calculateCombinedTotals([
            assetsData.pettyCashMain,
            assetsData.pettyCashProjects,
            assetsData.pettyCashEmployee,
            assetsData.mainCollection,
            assetsData.creditCardTransactions
        ]);
        
        // Bank totals
        assetsData.bankBalanceTotal = calculateCombinedTotals([
    assetsData.investBank,
    assetsData.investBankOthers,
    assetsData.blomBank,
    assetsData.adcbPtsAd,
    assetsData.adcbDubai,
    assetsData.adcbAccountSaver,  // NEW - ADDED TO CALCULATION
    assetsData.pemoNymcard
]);

        // Cash and cash equivalent
        assetsData.cashAndCashEquivalent = calculateCombinedTotals([
            assetsData.cashTotal,
            assetsData.bankBalanceTotal
        ]);

        // Bank margin deposits
        assetsData.bankMarginDeposits = calculateCombinedTotals([
            assetsData.marginPerformanceAdvance,
            assetsData.fixedDepositsUnderLien
        ]);

        // Trade receivables totals
        assetsData.loamsClientsTotal = calculateCombinedTotals([
            assetsData.loamsClients1,
            assetsData.loamsClients2
        ]);

        assetsData.provImpairmentTradeTotal = calculateCombinedTotals([
            assetsData.provImpairmentTrade1,
            assetsData.provImpairmentTrade2,
            assetsData.provImpairmentTrade3
        ]);

        // Net Trade Receivables (WIP is separate)
        assetsData.netTradeReceivables = calculateCombinedTotalsWithNegatives([
    assetsData.clientsCertifiedWorkks,      // 111101 - Should show 21,920,568
    assetsData.clientsAdvance,             // 111115 - 409,500
    assetsData.clientsNonCollectible,      // 111113 - 9,324,149
    assetsData.clientsIpaUncertified,      // 111109 - 27,239,054
    assetsData.maintenanceClients,         // 111105 - 62,146
    assetsData.loamsClientsTotal,          // 111111 + 111112 - 6,281,614
    assetsData.provImpairmentTradeTotal,   // 211850 + 211851 + 211853 - (-14,975,929)
    assetsData.provImpairmentRetention     // 211852 - (-822,300)
]);

        // Retention totals
        assetsData.retentionCertifiedTotal = calculateCombinedTotals([
            assetsData.retentionCertified1,
            assetsData.retentionCertified2
        ]);

        assetsData.provImpairmentShiftedToAR = {
            dec_prev: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0,
            jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };

        assetsData.netRetentionReceivables = calculateCombinedTotals([
            assetsData.retentionCertifiedTotal,
            assetsData.retentionAgainstPB,
            assetsData.retentionIpaUncertified,
            assetsData.provImpairmentShiftedToAR
        ]);

        // Inventory total
        assetsData.totalInventory = calculateCombinedTotals([
            assetsData.inventoryCivilMechanicalTiles
        ]);

        // Site Assets totals
        assetsData.siteAssetsToolsCostTotal = calculateCombinedTotals([
            assetsData.siteAssetsToolsCost1,
            assetsData.siteAssetsToolsCost2,
            assetsData.siteAssetsToolsCost3
        ]);

        assetsData.siteAssetsToolsDepnTotal = calculateCombinedTotals([
            assetsData.siteAssetsToolsDepn1,
            assetsData.siteAssetsToolsDepn2
        ]);

        // Net Property Plant & Equipment
        assetsData.netPropertyPlantEquipment = calculateCombinedTotals([
            assetsData.productionEquipmentCost,
            assetsData.productionEquipmentDepn,
            assetsData.officeEquipmentCost,
            assetsData.officeEquipmentDepn,
            assetsData.furnitureFixturesCost,
            assetsData.furnitureFixturesDepn,
            assetsData.computerSoftwareCost,
            assetsData.computerSoftwareDepn,
            assetsData.toolsCost,
            assetsData.toolsDepn,
            assetsData.carsVehiclesCost,
            assetsData.carsVehiclesDepn,
            assetsData.officeImprovementCost,
            assetsData.officeImprovementDepn,
            assetsData.siteAssetsToolsCostTotal,
            assetsData.siteAssetsToolsDepnTotal
        ]);

        // Right of Use Assets total
        assetsData.rightOfUseAssetsTotal = calculateCombinedTotals([
            assetsData.assetsOffice,
            assetsData.officeSpaceDepn
        ]);

        // Other Assets breakdown totals
        assetsData.loansAdvancesSuppliersTotal = calculateCombinedTotals([
    assetsData.loansAdvancesSuppliers,      // 112403
    assetsData.othersOverPaidSuppliers      // 112404
]);

        assetsData.prepaymentsTotal = calculateCombinedTotals([
    assetsData.rentPrepaidThirdParty,       // 566,406
    assetsData.rentPrepaidExpenses,         // 68,192
    assetsData.prepaidVisaExpense,          // 274,750
    assetsData.otherPrepaidExpenses         // 0
]);

        assetsData.refundableDepositsTotal = calculateCombinedTotals([
            assetsData.staffBankGuarantee,
            assetsData.refundableDepositsAccom,
            assetsData.dewaFewaEmicoolDeposits,
            assetsData.duDeposit,
            assetsData.refundableDepositsThirdParty,
            assetsData.otherDeposits
        ]);

        assetsData.otherAssetsTotal = calculateCombinedTotals([
    assetsData.loansAdvancesSuppliersTotal, // 2,529,151
    assetsData.prepaymentsTotal,            // 909,348
    assetsData.refundableDepositsTotal,     // 335,005
    
    assetsData.otherReceivables             // 605,892 (existing)
]);

        // TOTAL BALANCE SHEET ASSETS
        assetsData.totalBalanceSheetAssets = calculateCombinedTotals([
    assetsData.cashAndCashEquivalent,        // 1. Cash and Cash Equivalent
    assetsData.bankMarginDeposits,           // 2. Bank Margin Deposits  
    assetsData.netTradeReceivables,          // 3. Net Trade Receivables
    assetsData.netRetentionReceivables,      // 4. Net: Retention Receivables
    assetsData.dueFromAlPhoenician,          // 5. Due From Related Parties
    assetsData.contractWorkInProgress,       // 6. Contract Work in Progress (WIP)
    assetsData.totalInventory,               // 7. Inventory
    assetsData.netPropertyPlantEquipment,    // 8. Net Property And Equipment
    assetsData.rightOfUseAssetsTotal,        // 9. Right of Use Assets
    assetsData.otherAssetsTotal              // 10. OTHER ASSETS (ADVS+PREPAID+DEPOSIT)
]);
        
        console.log('✅ Complete Assets Schedule generated successfully');
        
        res.json({
            success: true,
            data: assetsData,
            period: `Year ${targetYear}`,
            logic: 'Complete Assets Schedule with Detailed Breakdowns',
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error generating extended assets schedule:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating extended assets schedule',
            error: error.message
        });
    }
});

// Helper function for combined totals with negatives
function calculateCombinedTotalsWithNegatives(dataArray) {
    const months = ['dec_prev', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const combinedTotals = {};
    
    months.forEach(month => {
        combinedTotals[month] = dataArray.reduce((sum, dataObj) => {
            return sum + (dataObj && dataObj[month] ? parseFloat(dataObj[month]) || 0 : 0);
        }, 0);
        combinedTotals[month] = customRound(combinedTotals[month]);
    });
    
    return combinedTotals;
}


async function getBankYearlyRunningBalances(accountNo, auxiliary, targetYear) {
    try {
        console.log(`🔍 Calculating bank balances for ${accountNo} (aux: ${auxiliary}) - Year ${targetYear}`);
        
        // Step 1: Get the opening balance for the target year
        const openingBalance = await getBankYearOpeningBalance(accountNo, auxiliary, targetYear);
        console.log(`📊 ${accountNo} (aux: ${auxiliary}) opening balance for ${targetYear}: ${openingBalance}`);
        
        // Step 2: Calculate monthly running balances for the target year
        const monthlyBalances = {
            dec_prev: openingBalance, // Opening balance (Dec of previous year)
            jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
            jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
        
        // Step 3: Calculate running balance for each month
        let runningBalance = openingBalance;
        
        const months = [
            { key: 'jan', num: 1 }, { key: 'feb', num: 2 }, { key: 'mar', num: 3 },
            { key: 'apr', num: 4 }, { key: 'may', num: 5 }, { key: 'jun', num: 6 },
            { key: 'jul', num: 7 }, { key: 'aug', num: 8 }, { key: 'sep', num: 9 },
            { key: 'oct', num: 10 }, { key: 'nov', num: 11 }, { key: 'dec', num: 12 }
        ];
        
        for (const month of months) {
            // Get net movement for this month with auxiliary filtering
            const netMovement = await getBankAccountMonthMovement(accountNo, auxiliary, targetYear, month.num);
            
            // Calculate running balance
            runningBalance = runningBalance + netMovement;
            monthlyBalances[month.key] = customRound(runningBalance);
            
            console.log(`📅 ${accountNo} (aux: ${auxiliary}) ${targetYear}-${month.num}: Previous=${customRound(runningBalance - netMovement)}, Movement=${netMovement}, Closing=${monthlyBalances[month.key]}`);
        }
        
        return monthlyBalances;
        
    } catch (error) {
        console.error(`❌ Error calculating bank balances for ${accountNo} (aux: ${auxiliary}):`, error);
        return {
            dec_prev: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0,
            jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
    }
}

async function getBankYearOpeningBalance(accountNo, auxiliary, targetYear) {
    try {
        console.log(`🔍 Getting bank opening balance for ${accountNo} (aux: ${auxiliary}) - Year ${targetYear}`);
        
        // Hardcoded bank opening balances for 2025 (Dec 2024 closing figures)
        const dec2024BankClosingBalances = {
            '110202_001': 1402,        // Invest Bank (aux 001)
            '110202_NOT_001': 5002485, // Invest Bank Others (aux NOT 001)
            '110210': 107548,          // BLOM Bank France/BANORIENT
            '110211': 23400,           // ADCB - PTS - AD
            '110212': 11260002,        // ADCB - Dubai
            '110214': 0,               // ADCB-(Account Saver) - NEW, NO OPENING BALANCE
            '110213': 322449           // PEMO - NYMCARD Payment Services LLC
        };
        
        // For 2025, use the hardcoded Dec 2024 balances
        if (targetYear === 2025) {
            let balanceKey;
            if (auxiliary === '001') {
                balanceKey = `${accountNo}_001`;
            } else if (auxiliary === 'NOT_001') {
                balanceKey = `${accountNo}_NOT_001`;
            } else {
                balanceKey = accountNo;
            }
            
            return dec2024BankClosingBalances[balanceKey] || 0;
        }
        
        // For other years, calculate the Dec closing of the previous year
        const previousYear = targetYear - 1;
        const prevYearClosing = await getBankDecemberClosingBalance(accountNo, auxiliary, previousYear);
        
        console.log(`📊 ${accountNo} (aux: ${auxiliary}) opening for ${targetYear} = Dec ${previousYear} closing: ${prevYearClosing}`);
        return prevYearClosing;
        
    } catch (error) {
        console.error(`❌ Error getting bank opening balance for ${accountNo} (aux: ${auxiliary}):`, error);
        return 0;
    }
}





// Add to your getYearOpeningBalance function
async function getYearOpeningBalance(accountNo, targetYear) {
    try {
        console.log(`🔍 Getting opening balance for ${accountNo} - Year ${targetYear}`);
        
        // Hardcoded opening balances for 2025 (your Dec 2024 closing figures)
        const dec2024ClosingBalances = {
    '110101': 37011,     // Petty Cash - Main
    '110102': 216506,    // Petty Cash - Projects
    '110103': 25997,     // Petty Cash - Employee  
    '110111': 12363,     // Main Collection
    '110112': 0,         // Credit Cards
    '112108': 7999827,   // Margin @ Performance & Advance Guarantee
    '112111': 0,         // Fixed Deposits Under Lien
    '111101': 21920568,  // Clients (Certified Works)
    '111115': 409500,    // Clients (Advance)
    '111113': 9324149,   // Clients (Non-collectible) - CORRECT ACCOUNT & AMOUNT
    '111109': 27239054,  // Clients - IPA (Un-Certified Works)
    '111105': 62146,     // Maintenance Clients
    '111111': 3140807,   // LOAMS-Clients 1 (half of 6,281,614)
    '111112': 3140807,   // LOAMS-Clients 2 (half of 6,281,614)
    '211850': -4991976,  // 1/3 of total (adjust with actual amounts)
    '211851': -4991976,  // 1/3 of total (adjust with actual amounts)
    '211853': -4991977,  // 1/3 of total (adjust with actual amounts)
    '211852': -822300,    // Less: Prov for Impairment of Retention (NEGATIVE)
    '111103': 6976548,    // Half of 13,953,096 (or provide actual split)
    '111114': 6976548,    // Half of 13,953,096 (or provide actual split)
    '111106': 1002603.34, // Retention Against P.B (Certified Works)
    '111110': 3462121.69, // Retention-IPA (Un-Certified Works)

    '110214': 0, 
    
    // Related Parties
    '112501': 176860.37,  // Due From Related Parties - Al Phoenician Nursery

    '111102': 0,         // NEW - Contract Work in Progress (WIP) - BLANK as requested
    '111104': 2543865,   // NEW - Inventory (Civil+Mechanical, Tiles) - Dec 2024: 2,543,865
    // CORRECTED EQUIPMENT ACCOUNTS
    // EQUIPMENT (unchanged)
    '120101': 1074029,   // B.A Production Equipments (Cost)
    '120201': -279590,   // B.A Production Equipment (Accd. Depn)
    '120102': 416300,    // B.B Office Equipment (Cost)
    '120202': -154271,   // B.B Office Equipment (Accd. Depn)
    '120103': 637785,    // B.C Furniture & Fixtures (Cost)
    '120203': -420126,   // B.C Furniture & Fixtures (Accd. Depn)
    '120104': 962066,    // B.D Computer Software & Accessories (Cost)
    '120204': -440454,   // B.D Computer Software & Accessories (Accd. Depn)
    '120105': 692324,    // B.E Tools (Cost)
    '120205': -304388,   // B.E Tools (Accumulated Depreciation)
    '120107': 1961418,   // B.F Cars & Vehicles (Cost)
    '120207': -312265,   // B.F Cars & Vehicles (Accd. Depn)
    '120110': 396290,    // B.G Office 399 Improvement (Cost)
    '120209': -275123,   // B.G Office 399 Improvement (Accd. Depn)
    '120111': 750459.5,  // B.H Site Assets Tools & Equips (Cost) - Part 1
    '120112': 750459.5,  // B.H Site Assets Tools & Equips (Cost) - Part 2
    '120211': -139161.5, // B.H Site Assets Tools & Equips (Accd. Depn) - Part 1
    '120212': -139161.5, // B.H Site Assets Tools & Equips (Accd. Depn) - Part 2
    
    // RIGHT OF USE ASSETS
    '120108': 0,         // Assets Office (3-99) - BLANK
    '120208': 0,         // Office Space (Accumulated Depn) - BLANK
    
    // LOANS AND ADVANCES (from image)
    '112403': 2495252,   // Loans and advances-Suppliers
    '112404': 33899,     // Others/Over Paid to Suppliers
    
    // PREPAYMENTS - CORRECTED VALUES
    '112341': 566406,    // Rent Prepaid - Third Party: 566,406
    '112351': 68192,     // Rent Prepaid Expenses: 68,192
    '112352': 274750,    // Prepaid Visa Expense: 274,750
    '112359': 0,         
         // Other Prepaid Expenses - CORRECTED: This gets the 274750 amount

    
    
    // REFUNDABLE DEPOSITS (from image)
    '1122': 96589,       // Staff Bank Guarantee
    '112101': 76700,     // Refundable Deposits @ Accommodation
    '112103': 30800,     // DEWA /FEWA & Emicool Deposits
    '112107': 2000,      // Du Deposit
    '112110': 125466,    // Refundable Deposits @ Third Party
    '112199': 3650,      // Other Deposits
    
    // OTHER RECEIVABLES
    '111503': 605892,    // Staff Loans and Advances Paid: 605,892
    '111503': 605892,     // Other Receivables
};


        // For 2025, use the hardcoded Dec 2024 balances
        if (targetYear === 2025) {
            return dec2024ClosingBalances[accountNo] || 0;
        }
        
        // For other years, calculate the Dec closing of the previous year
        const previousYear = targetYear - 1;
        const prevYearClosing = await getDecemberClosingBalance(accountNo, previousYear);
        
        console.log(`📊 ${accountNo} opening for ${targetYear} = Dec ${previousYear} closing: ${prevYearClosing}`);
        return prevYearClosing;
        
    } catch (error) {
        console.error(`❌ Error getting opening balance for ${accountNo}:`, error);
        return 0;
    }
}














// Add this endpoint to your server.js to debug account 111101 specifically for June 2025


function calculateCombinedTotalsWithNegatives(dataArray) {
    const months = ['dec_prev', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const combinedTotals = {};
    
    months.forEach(month => {
        combinedTotals[month] = dataArray.reduce((sum, dataObj) => {
            return sum + (dataObj && dataObj[month] ? parseFloat(dataObj[month]) || 0 : 0);
        }, 0);
        combinedTotals[month] = customRound(combinedTotals[month]);
    });
    
    return combinedTotals;
}


async function getBankDecemberClosingBalance(accountNo, auxiliary, year) {
    try {
        console.log(`🔍 Calculating Dec ${year} closing balance for ${accountNo} (aux: ${auxiliary})`);
        
        // Get opening balance for that year
        const yearOpening = await getBankYearOpeningBalance(accountNo, auxiliary, year);
        
        // Get total net movements for Jan through Dec of that year
        let totalMovements = 0;
        for (let month = 1; month <= 12; month++) {
            const monthMovement = await getBankAccountMonthMovement(accountNo, auxiliary, year, month);
            totalMovements += monthMovement;
        }
        
        const decClosing = yearOpening + totalMovements;
        console.log(`📊 ${accountNo} (aux: ${auxiliary}) Dec ${year} closing: Opening(${yearOpening}) + Movements(${totalMovements}) = ${decClosing}`);
        
        return customRound(decClosing);
        
    } catch (error) {
        console.error(`❌ Error calculating bank Dec closing for ${accountNo} (aux: ${auxiliary}):`, error);
        return 0;
    }
}


// COMPLETE FIX: Replace BOTH movement functions in your server.js

// 1. FIXED: Regular account movement calculation
async function getAccountMonthMovement(accountNo, year, month) {
    try {
        // List of accounts confirmed to have negative storage issues
        const accountsWithNegativeStorageIssues = [
            '111103', '111114', // Retention accounts with confirmed data corruption
            '111106',
            '110101' // ADDED: Retention Against P.B also has data issues
            // Add other problematic accounts here ONLY after confirming they have issues
        ];
        
        const needsAbsFix = accountsWithNegativeStorageIssues.includes(accountNo);
        
        let query;
        if (needsAbsFix) {
            // Use ABS() ONLY for confirmed problematic accounts
            query = `
                SELECT 
                    SUM(CASE 
                        WHEN debit_credit = 'D' THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                        ELSE 0 
                    END) as total_debits,
                    SUM(CASE 
                        WHEN debit_credit = 'C' THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                        ELSE 0 
                    END) as total_credits,
                    COUNT(*) as transaction_count
                FROM general_ledger 
                WHERE account_number = $1 
                  AND EXTRACT(YEAR FROM transaction_date) = $2
                  AND EXTRACT(MONTH FROM transaction_date) = $3
                  AND is_locked = false
            `;
            console.log(`[ABS-FIX] ${accountNo} ${year}-${month} - Using ABS() for confirmed problematic account`);
        } else {
            // Use ORIGINAL calculation for all other accounts
            query = `
                SELECT 
                    SUM(CASE WHEN debit_credit = 'D' THEN COALESCE(aed_amount, foreign_amount, 0) ELSE 0 END) as total_debits,
                    SUM(CASE WHEN debit_credit = 'C' THEN COALESCE(aed_amount, foreign_amount, 0) ELSE 0 END) as total_credits,
                    COUNT(*) as transaction_count
                FROM general_ledger 
                WHERE account_number = $1 
                  AND EXTRACT(YEAR FROM transaction_date) = $2
                  AND EXTRACT(MONTH FROM transaction_date) = $3
                  AND is_locked = false
            `;
        }
        
        const result = await queryDB(query, [accountNo, year, month]);
        
        const totalDebits = parseFloat(result.rows[0]?.total_debits) || 0;
        const totalCredits = parseFloat(result.rows[0]?.total_credits) || 0;
        const transactionCount = parseInt(result.rows[0]?.transaction_count) || 0;
        
        const netMovement = totalDebits - totalCredits;
        
        if (transactionCount > 0) {
            const label = needsAbsFix ? '[FIXED]' : '[NORMAL]';
            console.log(`${accountNo} ${year}-${month} ${label}: D=${totalDebits}, C=${totalCredits}, Net=${netMovement}, Txns=${transactionCount}`);
        }
        
        return netMovement;
        
    } catch (error) {
        console.error(`Error calculating movement for ${accountNo}:`, error);
        return 0;
    }
}


async function debugAccountData(accountNo, year, month) {
    try {
        const query = `
            SELECT 
                debit_credit,
                COUNT(*) as total_count,
                COUNT(CASE WHEN COALESCE(aed_amount, foreign_amount, 0) < 0 THEN 1 END) as negative_count,
                MIN(COALESCE(aed_amount, foreign_amount, 0)) as min_amount,
                MAX(COALESCE(aed_amount, foreign_amount, 0)) as max_amount,
                SUM(COALESCE(aed_amount, foreign_amount, 0)) as sum_raw,
                SUM(ABS(COALESCE(aed_amount, foreign_amount, 0))) as sum_abs
            FROM general_ledger 
            WHERE account_number = $1 
              AND EXTRACT(YEAR FROM transaction_date) = $2
              AND EXTRACT(MONTH FROM transaction_date) = $3
              AND is_locked = false
            GROUP BY debit_credit
            ORDER BY debit_credit
        `;
        
        const result = await queryDB(query, [accountNo, year, month]);
        
        console.log(`\n=== DEBUG DATA for ${accountNo} ${year}-${month} ===`);
        result.rows.forEach(row => {
            console.log(`${row.debit_credit}: ${row.total_count} txns, ${row.negative_count} negative, Range: ${row.min_amount} to ${row.max_amount}`);
            console.log(`  Raw Sum: ${row.sum_raw}, ABS Sum: ${row.sum_abs}`);
        });
        console.log(`=== END DEBUG ===\n`);
        
        return result.rows;
        
    } catch (error) {
        console.error(`Debug error for ${accountNo}:`, error);
        return [];
    }
}


async function getAccountMonthMovementV2(accountNo, year, month) {
    try {
        // List of accounts that specifically need ABS() fix
        const accountsNeedingAbsFix = [
            // Add account numbers here that specifically have the negative D&C issue
            // Example: '123456', '789012'
        ];
        
        const needsAbsFix = accountsNeedingAbsFix.includes(accountNo);
        
        let query;
        if (needsAbsFix) {
            // Apply ABS() only for specific problematic accounts
            query = `
                SELECT 
                    SUM(CASE 
                        WHEN debit_credit = 'D' THEN 
                            CASE 
                                WHEN COALESCE(aed_amount, foreign_amount, 0) < 0 
                                THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                                ELSE COALESCE(aed_amount, foreign_amount, 0)
                            END
                        ELSE 0 
                    END) as total_debits,
                    SUM(CASE 
                        WHEN debit_credit = 'C' THEN 
                            CASE 
                                WHEN COALESCE(aed_amount, foreign_amount, 0) < 0 
                                THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                                ELSE COALESCE(aed_amount, foreign_amount, 0)
                            END
                        ELSE 0 
                    END) as total_credits
                FROM general_ledger 
                WHERE account_number = $1 
                  AND EXTRACT(YEAR FROM transaction_date) = $2
                  AND EXTRACT(MONTH FROM transaction_date) = $3
                  AND is_locked = false
            `;
        } else {
            // Use original calculation for all other accounts
            query = `
                SELECT 
                    SUM(CASE WHEN debit_credit = 'D' THEN COALESCE(aed_amount, foreign_amount, 0) ELSE 0 END) as total_debits,
                    SUM(CASE WHEN debit_credit = 'C' THEN COALESCE(aed_amount, foreign_amount, 0) ELSE 0 END) as total_credits
                FROM general_ledger 
                WHERE account_number = $1 
                  AND EXTRACT(YEAR FROM transaction_date) = $2
                  AND EXTRACT(MONTH FROM transaction_date) = $3
                  AND is_locked = false
            `;
        }
        
        const result = await queryDB(query, [accountNo, year, month]);
        
        const totalDebits = parseFloat(result.rows[0]?.total_debits) || 0;
        const totalCredits = parseFloat(result.rows[0]?.total_credits) || 0;
        
        return totalDebits - totalCredits;
        
    } catch (error) {
        console.error(`❌ Error getting month movement for ${accountNo}:`, error);
        return 0;
    }
}

// RECOMMENDED SOLUTION: Revert to original for now, identify specific problem accounts later
async function getAccountMonthMovementSafe(accountNo, year, month) {
    try {
        // Use the original working logic for all accounts
        const query = `
            SELECT 
                SUM(CASE WHEN debit_credit = 'D' THEN COALESCE(aed_amount, foreign_amount, 0) ELSE 0 END) as total_debits,
                SUM(CASE WHEN debit_credit = 'C' THEN COALESCE(aed_amount, foreign_amount, 0) ELSE 0 END) as total_credits,
                COUNT(*) as transaction_count
            FROM general_ledger 
            WHERE account_number = $1 
              AND EXTRACT(YEAR FROM transaction_date) = $2
              AND EXTRACT(MONTH FROM transaction_date) = $3
              AND is_locked = false
        `;
        
        const result = await queryDB(query, [accountNo, year, month]);
        
        const totalDebits = parseFloat(result.rows[0]?.total_debits) || 0;
        const totalCredits = parseFloat(result.rows[0]?.total_credits) || 0;
        const transactionCount = parseInt(result.rows[0]?.transaction_count) || 0;
        
        const netMovement = totalDebits - totalCredits;
        
        if (transactionCount > 0) {
            console.log(`💰 ${accountNo} ${year}-${month}: Debits=${totalDebits}, Credits=${totalCredits}, Net=${netMovement}, Txns=${transactionCount}`);
        }
        
        return netMovement;
        
    } catch (error) {
        console.error(`❌ Error getting month movement for ${accountNo}:`, error);
        return 0;
    }
}

// 2. FIXED: Bank account movement calculation with auxiliary filtering
async function getBankAccountMonthMovement(accountNo, auxiliary, year, month) {
    try {
        let query;
        let params;
        
        if (auxiliary === null) {
            query = `
                SELECT 
                    SUM(CASE 
                        WHEN debit_credit = 'D' THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                        ELSE 0 
                    END) as total_debits,
                    SUM(CASE 
                        WHEN debit_credit = 'C' THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                        ELSE 0 
                    END) as total_credits,
                    COUNT(*) as transaction_count
                FROM general_ledger 
                WHERE account_number = $1 
                  AND EXTRACT(YEAR FROM transaction_date) = $2
                  AND EXTRACT(MONTH FROM transaction_date) = $3
                  AND is_locked = false
            `;
            params = [accountNo, year, month];
            
        } else if (auxiliary === '001') {
            query = `
                SELECT 
                    SUM(CASE 
                        WHEN debit_credit = 'D' THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                        ELSE 0 
                    END) as total_debits,
                    SUM(CASE 
                        WHEN debit_credit = 'C' THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                        ELSE 0 
                    END) as total_credits,
                    COUNT(*) as transaction_count
                FROM general_ledger 
                WHERE account_number = $1 
                  AND auxiliary_account = '001'
                  AND EXTRACT(YEAR FROM transaction_date) = $2
                  AND EXTRACT(MONTH FROM transaction_date) = $3
                  AND is_locked = false
            `;
            params = [accountNo, year, month];
            
        } else if (auxiliary === 'NOT_001') {
            query = `
                SELECT 
                    SUM(CASE 
                        WHEN debit_credit = 'D' THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                        ELSE 0 
                    END) as total_debits,
                    SUM(CASE 
                        WHEN debit_credit = 'C' THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                        ELSE 0 
                    END) as total_credits,
                    COUNT(*) as transaction_count
                FROM general_ledger 
                WHERE account_number = $1 
                  AND (auxiliary_account IS NULL OR auxiliary_account != '001')
                  AND EXTRACT(YEAR FROM transaction_date) = $2
                  AND EXTRACT(MONTH FROM transaction_date) = $3
                  AND is_locked = false
            `;
            params = [accountNo, year, month];
        }
        
        const result = await queryDB(query, params);
        
        const totalDebits = parseFloat(result.rows[0]?.total_debits) || 0;
        const totalCredits = parseFloat(result.rows[0]?.total_credits) || 0;
        const transactionCount = parseInt(result.rows[0]?.transaction_count) || 0;
        
        const netMovement = totalDebits - totalCredits;
        
        if (transactionCount > 0) {
            console.log(`🏦 ${accountNo} (aux: ${auxiliary}) ${year}-${month}: Debits=${totalDebits}, Credits=${totalCredits}, Net=${netMovement}, Txns=${transactionCount}`);
        }
        
        return netMovement;
        
    } catch (error) {
        console.error(`❌ Error getting bank month movement for ${accountNo} (aux: ${auxiliary}):`, error);
        return 0;
    }
}

// FIXED: Get yearly running balances with proper year-over-year calculation
async function getYearlyRunningBalances(accountNo, targetYear) {
    try {
        console.log(`🔍 Calculating yearly running balances for ${accountNo} - Year ${targetYear}`);
        
        const openingBalance = await getYearOpeningBalance(accountNo, targetYear);
        console.log(`📊 ${accountNo} opening balance for ${targetYear}: ${openingBalance}`);
        
        const monthlyBalances = {
            dec_prev: openingBalance,
            jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
            jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
        
        let runningBalance = parseFloat(openingBalance);
        
        const months = [
            { key: 'jan', num: 1 }, { key: 'feb', num: 2 }, { key: 'mar', num: 3 },
            { key: 'apr', num: 4 }, { key: 'may', num: 5 }, { key: 'jun', num: 6 },
            { key: 'jul', num: 7 }, { key: 'aug', num: 8 }, { key: 'sep', num: 9 },
            { key: 'oct', num: 10 }, { key: 'nov', num: 11 }, { key: 'dec', num: 12 }
        ];
        
        for (const month of months) {
            const netMovement = await getAccountMonthMovement(accountNo, targetYear, month.num);
            
            runningBalance = runningBalance + parseFloat(netMovement);
            monthlyBalances[month.key] = Math.round(runningBalance);
            
            console.log(`📅 ${accountNo} ${targetYear}-${month.num}: Previous=${Math.round(runningBalance - netMovement)}, Movement=${netMovement}, Closing=${monthlyBalances[month.key]}`);
        }
        
        return monthlyBalances;
        
    } catch (error) {
        console.error(`❌ Error calculating yearly balances for ${accountNo}:`, error);
        return {
            dec_prev: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0,
            jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
    }
}

async function getAccountYearlyBalances(accountNo, targetYear) {
    try {
        const openingBalance = await getYearOpeningBalance(accountNo, targetYear);
        
        const query = `
            WITH monthly_movements AS (
                SELECT 
                    EXTRACT(MONTH FROM transaction_date) as month,
                    SUM(CASE 
                        WHEN debit_credit = 'D' THEN 
                            CASE 
                                WHEN COALESCE(aed_amount, foreign_amount, 0) < 0 
                                THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                                ELSE COALESCE(aed_amount, foreign_amount, 0)
                            END
                        WHEN debit_credit = 'C' THEN 
                            -CASE 
                                WHEN COALESCE(aed_amount, foreign_amount, 0) < 0 
                                THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                                ELSE COALESCE(aed_amount, foreign_amount, 0)
                            END
                        ELSE 0 
                    END) as net_movement
                FROM general_ledger 
                WHERE account_number = $1
                  AND EXTRACT(YEAR FROM transaction_date) = $2
                  AND is_locked = false
                GROUP BY EXTRACT(MONTH FROM transaction_date)
            ),
            running_balances AS (
                SELECT 
                    month,
                    net_movement,
                    $3 + SUM(net_movement) OVER (ORDER BY month ROWS UNBOUNDED PRECEDING) as running_balance
                FROM monthly_movements
            )
            SELECT month, ROUND(running_balance) as balance
            FROM running_balances
            ORDER BY month;
        `;
        
        const result = await queryDB(query, [accountNo, targetYear, openingBalance]);
        
        const monthlyBalances = {
            dec_prev: openingBalance,
            jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
            jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
        
        const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        result.rows.forEach(row => {
            const monthIndex = row.month - 1;
            if (monthIndex >= 0 && monthIndex < 12) {
                monthlyBalances[monthKeys[monthIndex]] = parseInt(row.balance);
            }
        });
        
        return monthlyBalances;
        
    } catch (error) {
        console.error(`❌ Error calculating account balances:`, error);
        return {
            dec_prev: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0,
            jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
    }
}

// FIXED: Get proper opening balance for any year


// NEW: Get December closing balance for any year
async function getDecemberClosingBalance(accountNo, year) {
    try {
        console.log(`🔍 Calculating Dec ${year} closing balance for ${accountNo}`);
        
        // Get opening balance for that year
        const yearOpening = await getYearOpeningBalance(accountNo, year);
        
        // Get total net movements for Jan through Dec of that year
        let totalMovements = 0;
        for (let month = 1; month <= 12; month++) {
            const monthMovement = await getAccountMonthMovement(accountNo, year, month);
            totalMovements += monthMovement;
        }
        
        const decClosing = yearOpening + totalMovements;
        console.log(`📊 ${accountNo} Dec ${year} closing: Opening(${yearOpening}) + Movements(${totalMovements}) = ${decClosing}`);
        
        return customRound(decClosing);
        
    } catch (error) {
        console.error(`❌ Error calculating Dec closing for ${accountNo}:`, error);
        return 0;
    }
}

// FIXED: Get actual month movement from general ledger
// FIXED: Account movement calculation with conditional ABS() logic

function calculateCombinedTotals(dataArray) {
    const months = ['dec_prev', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const combinedTotals = {};
    
    months.forEach(month => {
        combinedTotals[month] = dataArray.reduce((sum, dataObj) => {
            return sum + (dataObj && dataObj[month] ? parseFloat(dataObj[month]) || 0 : 0);
        }, 0);
        combinedTotals[month] = customRound(combinedTotals[month]);
    });
    
    return combinedTotals;
}

// Keep your existing customRound function
function customRound(value) {
    if (isNaN(value) || value === null || value === undefined) {
        return 0;
    }
    
    // Keep decimals during calculation, only round for display
    return Math.round(parseFloat(value));
}



// Debugging endpoint - check what data exists for specific periods
app.get('/api/reports/debug-assets/:accountNo/:year/:month', async (req, res) => {
    try {
        const { accountNo, year, month } = req.params;
        
        console.log(`🐛 Debug: Checking ${accountNo} for ${year}-${month}`);
        
        // Get all transactions for this account/period
        const transactionsQuery = `
            SELECT 
                transaction_date,
                jv_number,
                description,
                debit_credit,
                COALESCE(aed_amount, foreign_amount, 0) as amount,
                currency_code
            FROM general_ledger 
            WHERE account_number = $1 
              AND EXTRACT(YEAR FROM transaction_date) = $2
              AND EXTRACT(MONTH FROM transaction_date) = $3
              AND is_locked = false
            ORDER BY transaction_date, jv_number
        `;
        
        const transactions = await queryDB(transactionsQuery, [accountNo, year, month]);
        const movement = await getAccountMonthMovement(accountNo, year, month);
        
        res.json({
            success: true,
            debug: {
                account: accountNo,
                period: `${year}-${month}`,
                transactionCount: transactions.rows.length,
                netMovement: movement,
                transactions: transactions.rows.slice(0, 10) // First 10 transactions
            }
        });
        
    } catch (error) {
        console.error('❌ Debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

console.log('✅ EXTENDED Assets Backend Logic Loaded');
console.log('🏦 Added Bank Balances Section with Auxiliary Filtering');
console.log('💰 Invest Bank: Account 110202, Aux 001');
console.log('🏛️ Invest Bank Others: Account 110202, Aux NOT 001');
console.log('🌍 Other Banks: Individual accounts without auxiliary');
console.log('📊 Dec 2024 hardcoded opening balances included');
console.log('====================================');




// DETAILED TRACE - Add this to debug the exact calculation issue

// 1. ENHANCED getAccountMonthMovement with detailed logging
async function getAccountMonthMovementDetailed(accountNo, year, month) {
    try {
        console.log(`=== DETAILED TRACE for ${accountNo} ${year}-${month} ===`);
        
        const query = `
            SELECT 
                transaction_date,
                jv_number,
                debit_credit,
                COALESCE(aed_amount, foreign_amount, 0) as original_amount,
                CASE 
                    WHEN debit_credit = 'D' THEN 
                        CASE 
                            WHEN COALESCE(aed_amount, foreign_amount, 0) < 0 
                            THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                            ELSE COALESCE(aed_amount, foreign_amount, 0)
                        END
                    ELSE 0 
                END as processed_debit,
                CASE 
                    WHEN debit_credit = 'C' THEN 
                        CASE 
                            WHEN COALESCE(aed_amount, foreign_amount, 0) < 0 
                            THEN ABS(COALESCE(aed_amount, foreign_amount, 0))
                            ELSE COALESCE(aed_amount, foreign_amount, 0)
                        END
                    ELSE 0 
                END as processed_credit,
                description
            FROM general_ledger 
            WHERE account_number = $1 
              AND EXTRACT(YEAR FROM transaction_date) = $2
              AND EXTRACT(MONTH FROM transaction_date) = $3
              AND is_locked = false
            ORDER BY transaction_date, jv_number
        `;
        
        const result = await queryDB(query, [accountNo, year, month]);
        
        let totalDebits = 0;
        let totalCredits = 0;
        let negativeAmountCount = 0;
        
        console.log(`Found ${result.rows.length} transactions`);
        
        // Process each transaction and log details
        result.rows.forEach((row, index) => {
            const processedDebit = parseFloat(row.processed_debit || 0);
            const processedCredit = parseFloat(row.processed_credit || 0);
            
            totalDebits += processedDebit;
            totalCredits += processedCredit;
            
            if (parseFloat(row.original_amount) < 0) {
                negativeAmountCount++;
                if (index < 5) { // Log first 5 negative amounts
                    console.log(`Negative amount found: JV=${row.jv_number}, DC=${row.debit_credit}, Original=${row.original_amount}, Processed D=${processedDebit}, C=${processedCredit}`);
                }
            }
        });
        
        const netMovement = totalDebits - totalCredits;
        
        console.log(`Total Debits: ${totalDebits}`);
        console.log(`Total Credits: ${totalCredits}`);
        console.log(`Net Movement: ${netMovement}`);
        console.log(`Negative amounts found: ${negativeAmountCount}`);
        console.log(`=== END DETAILED TRACE ===`);
        
        return netMovement;
        
    } catch (error) {
        console.error(`Error in detailed movement calculation:`, error);
        return 0;
    }
}

// 2. ENHANCED getYearlyRunningBalances with step-by-step logging
async function getYearlyRunningBalancesDetailed(accountNo, targetYear) {
    try {
        console.log(`\n🔍 DETAILED CALCULATION for ${accountNo} - Year ${targetYear}`);
        
        // Step 1: Get opening balance
        const openingBalance = await getYearOpeningBalance(accountNo, targetYear);
        console.log(`📊 Opening Balance (Dec ${targetYear-1}): ${openingBalance}`);
        
        // Step 2: Initialize monthly balances
        const monthlyBalances = {
            dec_prev: openingBalance,
            jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
            jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
        
        // Step 3: Calculate running balance for each month with detailed logging
        let runningBalance = parseFloat(openingBalance);
        console.log(`Starting Running Balance: ${runningBalance}`);
        
        const months = [
            { key: 'jan', num: 1 }, { key: 'feb', num: 2 }, { key: 'mar', num: 3 },
            { key: 'apr', num: 4 }, { key: 'may', num: 5 }, { key: 'jun', num: 6 },
            { key: 'jul', num: 7 }, { key: 'aug', num: 8 }, { key: 'sep', num: 9 },
            { key: 'oct', num: 10 }, { key: 'nov', num: 11 }, { key: 'dec', num: 12 }
        ];
        
        for (const month of months) {
            console.log(`\n--- Processing ${month.key.toUpperCase()} (Month ${month.num}) ---`);
            console.log(`Previous Balance: ${runningBalance}`);
            
            // Get movement using detailed function for January, regular for others
            let netMovement;
            if (month.key === 'jan') {
                netMovement = await getAccountMonthMovementDetailed(accountNo, targetYear, month.num);
            } else {
                netMovement = await getAccountMonthMovement(accountNo, targetYear, month.num);
            }
            
            console.log(`Net Movement: ${netMovement}`);
            
            // Calculate new running balance
            const newRunningBalance = runningBalance + parseFloat(netMovement);
            runningBalance = newRunningBalance;
            monthlyBalances[month.key] = Math.round(runningBalance);
            
            console.log(`New Running Balance: ${newRunningBalance}`);
            console.log(`Rounded Balance: ${monthlyBalances[month.key]}`);
            
            // Special check for January
            if (month.key === 'jan') {
                const expectedJanBalance = openingBalance + 3844382.41;
                console.log(`\n🔍 JANUARY ANALYSIS:`);
                console.log(`Expected Jan Balance: ${openingBalance} + 3844382.41 = ${expectedJanBalance}`);
                console.log(`Actual Calculated: ${newRunningBalance}`);
                console.log(`Difference: ${newRunningBalance - expectedJanBalance}`);
                
                if (Math.abs(newRunningBalance - expectedJanBalance) > 1) {
                    console.log(`❌ MISMATCH DETECTED!`);
                    console.log(`Expected Movement: 3844382.41`);
                    console.log(`Actual Movement: ${netMovement}`);
                    console.log(`Movement Difference: ${netMovement - 3844382.41}`);
                }
            }
        }
        
        console.log(`\n✅ Final Monthly Balances for ${accountNo}:`);
        Object.entries(monthlyBalances).forEach(([month, balance]) => {
            console.log(`${month}: ${balance}`);
        });
        
        return monthlyBalances;
        
    } catch (error) {
        console.error(`Error in detailed yearly balances:`, error);
        return {
            dec_prev: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0,
            jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
    }
}

// 3. Test endpoint to trace the exact issue
app.get('/api/trace/account/:accountNo/:year', async (req, res) => {
    try {
        const { accountNo, year } = req.params;
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`TRACING CALCULATION ISSUE FOR ACCOUNT ${accountNo} YEAR ${year}`);
        console.log(`${'='.repeat(80)}`);
        
        // Get detailed calculation
        const detailedResult = await getYearlyRunningBalancesDetailed(accountNo, parseInt(year));
        
        // Also get the database query result for comparison
        const dbQuery = `
            SELECT
                EXTRACT(MONTH FROM transaction_date) as month,
                COUNT(*) as count,
                SUM(CASE WHEN debit_credit = 'D' THEN COALESCE(aed_amount, foreign_amount, 0)
                         WHEN debit_credit = 'C' THEN -COALESCE(aed_amount, foreign_amount, 0)
                         ELSE 0 END) as net_movement_db
            FROM general_ledger
            WHERE account_number = $1
              AND EXTRACT(YEAR FROM transaction_date) = $2
              AND is_locked = false
            GROUP BY EXTRACT(MONTH FROM transaction_date)
            ORDER BY EXTRACT(MONTH FROM transaction_date)
        `;
        
        const dbResult = await queryDB(dbQuery, [accountNo, year]);
        
        console.log(`\n📊 DATABASE QUERY RESULTS:`);
        dbResult.rows.forEach(row => {
            console.log(`Month ${row.month}: Net Movement = ${row.net_movement_db}, Transactions = ${row.count}`);
        });
        
        res.json({
            success: true,
            trace: {
                account: accountNo,
                year: year,
                detailedBalances: detailedResult,
                databaseMovements: dbResult.rows,
                analysis: {
                    openingBalance: 21920568,
                    expectedJanMovement: 3844382.41,
                    expectedJanBalance: 21920568 + 3844382.41,
                    actualJanBalance: detailedResult.jan,
                    difference: detailedResult.jan - (21920568 + 3844382.41)
                }
            }
        });
        
    } catch (error) {
        console.error('Trace error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});














app.get('/api/budget/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        console.log(`📊 Fetching budget data for ${year}-${month}...`);
        
        // Month column mapping
        const monthColumns = [
            'jan_amount', 'feb_amount', 'mar_amount', 'apr_amount', 
            'may_amount', 'jun_amount', 'jul_amount', 'aug_amount', 
            'sep_amount', 'oct_amount', 'nov_amount', 'dec_amount'
        ];
        
        const monthColumn = monthColumns[month - 1];
        if (!monthColumn) {
            return res.status(400).json({
                success: false,
                message: 'Invalid month parameter'
            });
        }
        
        const query = `
            SELECT 
                particular_name,
                category,
                ${monthColumn} as budget_amount,
                is_percentage
            FROM budget_data
            WHERE budget_year = $1
            AND budget_type = 'Consolidated'
            ORDER BY display_order
        `;
        
        const result = await queryDB(query, [year]);
        
        // Create a budget mapping object
        const budgetMap = {};
        result.rows.forEach(row => {
            budgetMap[row.particular_name] = {
                amount: parseFloat(row.budget_amount) || 0,
                isPercentage: row.is_percentage
            };
        });
        
        console.log(`✅ Found ${result.rows.length} budget entries for month ${month}, year ${year}`);
        
        res.json({
            success: true,
            data: budgetMap,
            period: `${year}-${String(month).padStart(2, '0')}`,
            month: month,
            year: year,
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching budget data:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching budget data',
            error: error.message
        });
    }
});

app.get('/api/reports/verify-accounts/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        
        // Get all accounts that have transactions in the period
        const result = await queryDB(`
            SELECT DISTINCT 
                gl.account_number,
                coa.name,
                COUNT(*) as transaction_count,
                SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as total_debits,
                SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as total_credits
            FROM general_ledger gl
            LEFT JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
            WHERE EXTRACT(YEAR FROM gl.transaction_date) = $1
              AND EXTRACT(MONTH FROM gl.transaction_date) = $2
              AND gl.is_locked = false
            GROUP BY gl.account_number, coa.name
            HAVING SUM(COALESCE(gl.aed_amount, gl.foreign_amount, 0)) != 0
            ORDER BY gl.account_number
        `, [year, month]);

        res.json({
            success: true,
            data: result.rows,
            period: `${year}-${String(month).padStart(2, '0')}`,
            total: result.rows.length
        });

    } catch (error) {
        console.error('❌ Error verifying accounts:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error verifying accounts',
            error: error.message
        });
    }
});






// Delete general ledger entry
app.delete('/api/general-ledger/:id', async (req, res) => {
    try {
        // Check if entry is locked
        const lockCheck = await queryDB('SELECT is_locked FROM general_ledger WHERE id = $1', [req.params.id]);
        
        if (lockCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Entry not found' });
        }

        if (lockCheck.rows[0].is_locked) {
            return res.status(400).json({ success: false, message: 'Cannot delete locked entry' });
        }

        const result = await queryDB(
            'DELETE FROM general_ledger WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Entry not found' });
        }

        res.json({ 
            success: true, 
            message: 'Entry deleted successfully', 
            data: result.rows[0] 
        });

    } catch (error) {
        console.error('Error deleting entry:', error.message);
        res.status(500).json({ success: false, message: 'Error deleting entry', error: error.message });
    }
});

// Get general ledger statistics
app.get('/api/general-ledger/stats', async (req, res) => {
    try {
        console.log('📈 Fetching general ledger statistics...');

        const totalResult = await queryDB('SELECT COUNT(*) FROM general_ledger');
        const pendingResult = await queryDB('SELECT COUNT(*) FROM general_ledger WHERE is_pending = true');
        const lockedResult = await queryDB('SELECT COUNT(*) FROM general_ledger WHERE is_locked = true');
        const recentResult = await queryDB(
            'SELECT COUNT(*) FROM general_ledger WHERE created_on >= CURRENT_DATE - INTERVAL \'7 days\''
        );

        // Currency breakdown
        const currencyResult = await queryDB(`
            SELECT 
                currency_code,
                COUNT(*) as count,
                SUM(CASE WHEN debit_credit = 'D' THEN 
                    CASE currency_code 
                        WHEN 'AED' THEN aed_amount 
                        WHEN 'USD' THEN usd_amount 
                        ELSE foreign_amount 
                    END 
                    ELSE 0 
                END) as total_debits,
                SUM(CASE WHEN debit_credit = 'C' THEN 
                    CASE currency_code 
                        WHEN 'AED' THEN aed_amount 
                        WHEN 'USD' THEN usd_amount 
                        ELSE foreign_amount 
                    END 
                    ELSE 0 
                END) as total_credits
            FROM general_ledger 
            GROUP BY currency_code
            ORDER BY currency_code
        `);

        const stats = {
            totalEntries: parseInt(totalResult.rows[0].count),
            pendingEntries: parseInt(pendingResult.rows[0].count),
            lockedEntries: parseInt(lockedResult.rows[0].count),
            recentEntries: parseInt(recentResult.rows[0].count),
            currencyBreakdown: currencyResult.rows
        };

        console.log('✅ Statistics:', stats);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Error fetching statistics:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error.message
        });
    }
});

// Bulk operations for general ledger
app.post('/api/general-ledger/bulk-import', async (req, res) => {
    try {
        const { entries } = req.body;
        
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ success: false, message: 'No entries provided' });
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        console.log(`🔄 Importing ${entries.length} general ledger entries...`);

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            try {
                // Validate required fields
                if (!entry.transaction_date || !entry.jv_number || !entry.year_period || !entry.account_number) {
                    errorCount++;
                    errors.push(`Row ${i + 1}: Missing required fields`);
                    continue;
                }

                // Validate account exists
                const accountCheck = await queryDB(
                    'SELECT pts_account_no FROM chart_of_accounts WHERE pts_account_no = $1',
                    [entry.account_number]
                );

                if (accountCheck.rows.length === 0) {
                    errorCount++;
                    errors.push(`Row ${i + 1}: Invalid account number ${entry.account_number}`);
                    continue;
                }

                // Insert entry
                await queryDB(`
                    INSERT INTO general_ledger (
                        transaction_date, jv_number, year_period, batch_number, batch_sequence,
                        transaction_type, type_sequence, account_number, auxiliary_account, account_name,
                        cc2, shipment, doc_ref, doc_date, m_classification, description, debit_credit,
                        currency_code, foreign_amount, aed_amount, usd_amount, is_pending, is_locked,
                        created_by, updated_by
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                        $21, $22, $23, $24, $25
                    )
                `, [
                    entry.transaction_date, entry.jv_number, entry.year_period, 
                    entry.batch_number, entry.batch_sequence, entry.transaction_type, entry.type_sequence,
                    entry.account_number, entry.auxiliary_account, entry.account_name,
                    entry.cc2, entry.shipment, entry.doc_ref, entry.doc_date, 
                    entry.m_classification, entry.description, entry.debit_credit,
                    entry.currency_code || 'AED', entry.foreign_amount, entry.aed_amount, entry.usd_amount,
                    entry.is_pending || false, entry.is_locked || false,
                    entry.created_by || 'IMPORT', entry.updated_by || 'IMPORT'
                ]);

                successCount++;

            } catch (entryError) {
                errorCount++;
                errors.push(`Row ${i + 1}: ${entryError.message}`);
                console.error(`❌ Error processing entry ${i + 1}:`, entryError.message);
            }
        }

        console.log(`✅ Import completed: ${successCount} success, ${errorCount} errors`);

        res.json({
            success: true,
            message: `Import completed: ${successCount} successful, ${errorCount} errors`,
            data: {
                successCount,
                errorCount,
                totalProcessed: entries.length,
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

// Search general ledger entries
app.get('/api/general-ledger/search/:query', async (req, res) => {
    try {
        const result = await queryDB(`
            SELECT 
                id, transaction_date, jv_number, year_period, account_number, account_name,
                description, debit_credit, currency_code, aed_amount, is_pending, is_locked
            FROM general_ledger 
            WHERE 
                jv_number ILIKE $1 OR 
                description ILIKE $1 OR 
                doc_ref ILIKE $1 OR
                account_name ILIKE $1 OR
                account_number ILIKE $1
            ORDER BY transaction_date DESC, jv_number
            LIMIT 100
        `, [`%${req.params.query}%`]);

        res.json({ 
            success: true, 
            data: result.rows, 
            total: result.rows.length 
        });

    } catch (error) {
        console.error('Error searching entries:', error.message);
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