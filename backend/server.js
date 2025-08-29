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



app.get('/api/reports/pl-complete/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        console.log(`📊 Generating complete P&L report for ${year}-${month}...`);
        
        // Specific revenue accounts
        const revenueAccounts = [
            '42', '4102', '4103', '4104', '4105', '4109', '4201', 
            '410101', '410102', '410103', '410104', '410105', '410106', '410107',
            '410201', '410202', '410203', '410204', '410205', '410206', '410207', '410208', '410209',
            '410301', '410401', '410501', '410502', '410503', '410901',
            '419', '419001', '419002'
        ];

        const previousMonth = month > 1 ? month - 1 : 12;
        const previousYear = month > 1 ? year : year - 1;

        // Helper function to get category totals
        async function getCategoryTotals(yearParam, monthCondition, accounts = null, accountType = null) {
            let whereClause = '';
            let params = [yearParam];
            
            if (accounts) {
                whereClause = 'WHERE gl.account_number = ANY($2)';
                params.push(accounts);
            } else if (accountType) {
                whereClause = `WHERE gl.account_number LIKE '${accountType}%'`;
            }
            
            whereClause += ` AND EXTRACT(YEAR FROM gl.transaction_date) = $1 ${monthCondition} AND gl.is_locked = false`;
            
            const query = `
                SELECT 
                    SUM(CASE WHEN gl.debit_credit = 'C' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as total_credits,
                    SUM(CASE WHEN gl.debit_credit = 'D' THEN COALESCE(gl.aed_amount, gl.foreign_amount, 0) ELSE 0 END) as total_debits
                FROM general_ledger gl
                JOIN chart_of_accounts coa ON gl.account_number = coa.pts_account_no
                ${whereClause}
            `;
            
            const result = await queryDB(query, params);
            return result.rows[0] || { total_credits: 0, total_debits: 0 };
        }

        // Get all data in parallel
        const [
            // ACTUAL (Current month only)
            revenueActual,
            costsActual,
            expensesActual,
            
            // CUMULATIVE (Jan to current month)
            revenueCumulative,
            costsCumulative,
            expensesCumulative,
            
            // PREVIOUS (Jan to previous month)
            revenuePrevious,
            costsPrevious,
            expensesPrevious
        ] = await Promise.all([
            // ACTUAL
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, revenueAccounts),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, null, '5'),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) = ${month}`, null, '6'),
            
            // CUMULATIVE
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, revenueAccounts),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, null, '5'),
            getCategoryTotals(year, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${month}`, null, '6'),
            
            // PREVIOUS
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, revenueAccounts),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, null, '5'),
            getCategoryTotals(previousYear, `AND EXTRACT(MONTH FROM gl.transaction_date) <= ${previousMonth}`, null, '6')
        ]);

        // Calculate net amounts (Revenue: Credit-Debit, Costs/Expenses: Debit-Credit)
        const calculateRevenue = (data) => parseFloat(data.total_credits || 0) - parseFloat(data.total_debits || 0);
        const calculateExpense = (data) => parseFloat(data.total_debits || 0) - parseFloat(data.total_credits || 0);

        // REVENUE totals
        const revenue = {
            actual: calculateRevenue(revenueActual),
            cumulative: calculateRevenue(revenueCumulative),
            previous: calculateRevenue(revenuePrevious)
        };

        // DIRECT COST totals
        const directCost = {
            actual: calculateExpense(costsActual),
            cumulative: calculateExpense(costsCumulative),
            previous: calculateExpense(costsPrevious)
        };

        // EXPENSES totals
        const expenses = {
            actual: calculateExpense(expensesActual),
            cumulative: calculateExpense(expensesCumulative),
            previous: calculateExpense(expensesPrevious)
        };

        // GROSS PROFIT = Revenue - Direct Cost
        const grossProfit = {
            actual: revenue.actual - directCost.actual,
            cumulative: revenue.cumulative - directCost.cumulative,
            previous: revenue.previous - directCost.previous
        };

        // NET PROFIT = Gross Profit - Expenses
        const netProfit = {
            actual: grossProfit.actual - expenses.actual,
            cumulative: grossProfit.cumulative - expenses.cumulative,
            previous: grossProfit.previous - expenses.previous
        };

        console.log(`✅ Complete P&L Generated:`);
        console.log(`Revenue: ${revenue.actual} | ${revenue.cumulative} | ${revenue.previous}`);
        console.log(`Direct Cost: ${directCost.actual} | ${directCost.cumulative} | ${directCost.previous}`);
        console.log(`Expenses: ${expenses.actual} | ${expenses.cumulative} | ${expenses.previous}`);
        console.log(`Net Profit: ${netProfit.actual} | ${netProfit.cumulative} | ${netProfit.previous}`);

        res.json({
            success: true,
            data: {
                period: `${year}-${String(month).padStart(2, '0')}`,
                summary: {
                    revenue: revenue,
                    directCost: directCost,
                    totalDirectCost: directCost, // Same as directCost for display
                    grossProfit: grossProfit,
                    expenses: expenses,
                    totalExpenses: expenses, // Same as expenses for display
                    netProfit: netProfit
                },
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error generating complete P&L report:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error generating complete P&L report',
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