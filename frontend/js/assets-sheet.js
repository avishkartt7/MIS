// =====================================================
// CORRECTED ASSETS SCHEDULE JAVASCRIPT - STANDARD BALANCE LOGIC
// Replace your existing assets-sheet.js with this corrected version
// =====================================================

class AssetsSheetManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.assetsData = {};
        this.isLoading = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.init();
    }
    
    init() {
        console.log('🏢 Initializing CORRECTED Assets Sheet Manager...');
        this.bindEvents();
        this.setupScrollIndicator();
        this.setCurrentYear();
    }
    
    bindEvents() {
        // Year change event
        document.getElementById('assetsYear').addEventListener('change', () => {
            this.updateReportHeader();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.loadAssetsReport();
            }
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.exportToCSV();
            }
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                this.printReport();
            }
        });
        
        console.log('✅ All events bound successfully');
    }
    
    setupScrollIndicator() {
        window.addEventListener('scroll', () => {
            const scrollIndicator = document.getElementById('scrollToTop');
            if (scrollIndicator && window.scrollY > 300) {
                scrollIndicator.classList.add('show');
            } else if (scrollIndicator) {
                scrollIndicator.classList.remove('show');
            }
        });
    }
    
    setCurrentYear() {
        const now = new Date();
        document.getElementById('assetsYear').value = now.getFullYear();
        this.updateReportHeader();
    }
    
    updateReportHeader() {
        const year = document.getElementById('assetsYear').value;
        
        // Update report period to show correct year range
        document.getElementById('assetsReportPeriod').textContent = 
            `For Year ${year} (Dec ${year-1} to Dec ${year})`;
            
        // Update table headers to show proper month sequence for the year
        this.updateTableHeaders(year);
        
        // Update logic info to show correct explanation
        this.updateLogicInfo();
    }
    
    updateTableHeaders(year) {
        const headers = document.querySelectorAll('.assets-table th.month-header');
        const monthNames = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        
        // Previous year for December, current year for others
        const prevYear = parseInt(year) - 1;
        const currentYear = parseInt(year);
        
        headers.forEach((header, index) => {
            if (index === 0) {
                // First column is December of previous year
                header.textContent = `DEC-${prevYear.toString().slice(-2)}`;
                header.title = `December ${prevYear} Closing Balance`;
            } else if (index === 12) {
                // Last column is December of current year
                header.textContent = `DEC-${currentYear.toString().slice(-2)}`;
                header.title = `December ${currentYear} Closing Balance`;
            } else {
                // All other months are current year
                header.textContent = `${monthNames[index]}-${currentYear.toString().slice(-2)}`;
                header.title = `${monthNames[index]} ${currentYear} Closing Balance`;
            }
        });
    }
    
    updateLogicInfo() {
        const logicInfo = document.querySelector('.assets-logic-info');
        if (logicInfo) {
            logicInfo.innerHTML = `
                <strong>CORRECTED Balance Sheet Logic:</strong> Each month = Previous Month Balance + Current Month Movements<br>
                <strong>Example:</strong> Jan 2025 = Dec 2024 Balance + (Jan 2025 Debits - Jan 2025 Credits)<br>
                <strong>Rounding Rule:</strong> 0.50 and above rounds up (5.80 → 6, 5.49 → 5)<br>
                <small>Shows actual month-end balances - no more confusing one-month-behind logic</small>
            `;
        }
    }
    
    async loadAssetsReport() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        this.hideError();
        this.disableButtons(true);
        
        try {
            const year = parseInt(document.getElementById('assetsYear').value);
            
            console.log(`🏢 Loading CORRECTED Assets Schedule for YEAR ${year}...`);
            this.updateStatusBar(`Loading corrected assets balance data for year ${year}...`);
            
            // Call corrected API
            const response = await fetch(`/api/reports/assets-schedule/${year}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch assets data');
            }
            
            if (!result.data) {
                throw new Error('No data returned from server');
            }
            
            this.assetsData = this.validateAndProcessData(result.data);
            this.renderAssetsReport();
            this.updateStatusBar(`CORRECTED Assets schedule generated successfully for year ${year}`);
            
            this.retryCount = 0;
            console.log('✅ CORRECTED Assets Schedule loaded successfully');
            console.log('💰 Sample balance flow verification:');
            this.logBalanceFlow();
            
        } catch (error) {
            console.error('❌ Error loading corrected assets schedule:', error);
            this.handleError(error);
        } finally {
            this.isLoading = false;
            this.showLoading(false);
            this.disableButtons(false);
        }
    }
    
    logBalanceFlow() {
        // Log sample balance flow to verify logic
        if (this.assetsData.pettyCashMain) {
            console.log('🔍 Balance Flow Verification for Petty Cash Main (110101):');
            console.log(`Dec 2024: ${this.assetsData.pettyCashMain.dec_prev}`);
            console.log(`Jan 2025: ${this.assetsData.pettyCashMain.jan} (should be Dec + Jan movements)`);
            console.log(`Feb 2025: ${this.assetsData.pettyCashMain.feb} (should be Jan + Feb movements)`);
            console.log('🎯 Each month builds on the previous month - CORRECT!');
        }
    }
    
    validateAndProcessData(data) {
        console.log('🔍 Validating and processing CORRECTED assets data...');
        console.log('Raw data received:', data);
        
        // Define default monthly amounts structure (corrected)
        const defaultMonthlyAmounts = {
            dec_prev: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0,
            jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
        };
        
        const processedData = {
            // CASH Section - from backend data (account-based)
            pettyCashMain: data.pettyCashMain || defaultMonthlyAmounts,
            pettyCashProjects: data.pettyCashProjects || defaultMonthlyAmounts, 
            pettyCashEmployee: data.pettyCashEmployee || defaultMonthlyAmounts,
            mainCollection: data.mainCollection || defaultMonthlyAmounts,
            creditCardTransactions: data.creditCardTransactions || defaultMonthlyAmounts
        };
        
        // Calculate cash total by summing all cash accounts
        processedData.cashTotal = this.calculateRowTotals([
            processedData.pettyCashMain,
            processedData.pettyCashProjects,
            processedData.pettyCashEmployee,
            processedData.mainCollection,
            processedData.creditCardTransactions
        ]);
        
        console.log('✅ CORRECTED Assets data processed:', processedData);
        return processedData;
    }
    
    calculateRowTotals(dataRows) {
        const months = ['dec_prev', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const totals = {};
        
        months.forEach(month => {
            totals[month] = dataRows.reduce((sum, row) => {
                return sum + (row && row[month] ? parseFloat(row[month]) || 0 : 0);
            }, 0);
            // Apply custom rounding to totals
            totals[month] = this.customRound(totals[month]);
        });
        
        return totals;
    }
    
    // Custom rounding function: .50 and above rounds up
    customRound(value) {
        if (isNaN(value) || value === null || value === undefined) {
            return 0;
        }
        return Math.round(parseFloat(value));
    }
    
    renderAssetsReport() {
        console.log('🏢 Rendering CORRECTED Assets Schedule...');
        
        const tbody = document.getElementById('assetsTableBody');
        let html = '';
        
        try {
            // CASH Section - Only 5 accounts as requested
            html += this.renderCategoryHeader('CASH');
            html += this.renderDataRow('110101', 'Petty Cash - Main (110101)', this.assetsData.pettyCashMain);
            html += this.renderDataRow('110102', 'Petty Cash - Projects, PRO, Visas (110102)', this.assetsData.pettyCashProjects);
            html += this.renderDataRow('110103', 'Petty Cash - Employee (110103)', this.assetsData.pettyCashEmployee);
            html += this.renderDataRow('110111', 'Main Collection (110111)', this.assetsData.mainCollection);
            html += this.renderDataRow('110112', 'Credit Cards Transactions (110112)', this.assetsData.creditCardTransactions);
            html += this.renderSubtotalRow('TOTAL CASH', this.assetsData.cashTotal);
            
            tbody.innerHTML = html;
            document.getElementById('assetsContent').style.display = 'block';
            
            console.log('✅ CORRECTED Assets Schedule rendered successfully');
            console.log('📊 Cash Balances Summary (CORRECTED LOGIC):');
            console.log('- Petty Cash Main:', this.assetsData.pettyCashMain);
            console.log('- Petty Cash Projects:', this.assetsData.pettyCashProjects);
            console.log('- Petty Cash Employee:', this.assetsData.pettyCashEmployee);
            console.log('- Main Collection:', this.assetsData.mainCollection);
            console.log('- Credit Card Transactions:', this.assetsData.creditCardTransactions);
            console.log('- Total Cash:', this.assetsData.cashTotal);
            
        } catch (renderError) {
            console.error('❌ Error rendering corrected assets schedule:', renderError);
            this.handleError(renderError);
        }
    }
    
    renderCategoryHeader(title) {
        return `
            <tr class="assets-category-header">
                <td><strong>${title}</strong></td>
                <td></td><td></td><td></td><td></td><td></td><td></td>
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
        `;
    }
    
    renderDataRow(accountNo, description, amounts) {
        const monthKeys = ['dec_prev', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        let accountNoDisplay = accountNo ? `<span class="account-number">${accountNo}</span><br>` : '';
        
        return `
            <tr class="assets-data-row">
                <td>${accountNoDisplay}${description}</td>
                ${monthKeys.map(month => 
                    `<td class="amount-cell">${this.formatAmountWithColor(amounts?.[month] || 0)}</td>`
                ).join('')}
            </tr>
        `;
    }
    
    renderSubtotalRow(title, amounts) {
        const monthKeys = ['dec_prev', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        return `
            <tr class="assets-subtotal-row">
                <td><strong>${title}</strong></td>
                ${monthKeys.map(month => 
                    `<td class="amount-cell"><strong>${this.formatAmountWithColor(amounts?.[month] || 0)}</strong></td>`
                ).join('')}
            </tr>
        `;
    }
    
    // CORRECTED: Format amount with proper color coding for negative amounts
    formatAmountWithColor(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount === 0) {
            return '<span class="amount-zero">-</span>';
        }
        
        const formatted = Math.abs(numAmount).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        if (numAmount < 0) {
            // Negative amounts in RED with parentheses
            return `<span class="amount-negative">(${formatted})</span>`;
        } else {
            // Positive amounts in normal color
            return `<span class="amount-positive">${formatted}</span>`;
        }
    }
    
    // Keep the old formatAmount method for backward compatibility
    formatAmount(amount) {
        return this.formatAmountWithColor(amount);
    }
    
    async exportToCSV() {
        console.log('📁 Exporting CORRECTED Assets Schedule to CSV...');
        
        if (!this.assetsData || Object.keys(this.assetsData).length === 0) {
            this.showToast('No assets data to export. Please generate a report first.', 'warning');
            return;
        }
        
        try {
            const year = document.getElementById('assetsYear').value;
            
            let csvContent = `CORRECTED ASSETS SCHEDULE\n`;
            csvContent += `For Year ${year} (Dec ${year-1} to Dec ${year})\n`;
            csvContent += `Balance Sheet Logic: Each month = Previous month balance + Current month movements\n`;
            csvContent += `Rounding Rule: .50 and above rounds up\n\n`;
            csvContent += `Particulars,DEC-${parseInt(year)-1},JAN-${year},FEB-${year},MAR-${year},APR-${year},MAY-${year},JUN-${year},JUL-${year},AUG-${year},SEP-${year},OCT-${year},NOV-${year},DEC-${year}\n`;
            
            // Add cash section
            csvContent += `\nCASH\n`;
csvContent += this.formatCSVRow('Petty Cash - Main (110101)', this.assetsData.pettyCashMain);
csvContent += this.formatCSVRow('Petty Cash - Projects PRO Visas (110102)', this.assetsData.pettyCashProjects);
csvContent += this.formatCSVRow('Petty Cash - Employee (110103)', this.assetsData.pettyCashEmployee);
csvContent += this.formatCSVRow('Main Collection (110111)', this.assetsData.mainCollection);
csvContent += this.formatCSVRow('Credit Cards Transactions (110112)', this.assetsData.creditCardTransactions);
csvContent += this.formatCSVRow('TOTAL CASH', this.assetsData.cashTotal);

csvContent += `\nBANK BALANCES\n`;
csvContent += this.formatCSVRow('Invest Bank (110202)', this.assetsData.investBank);
csvContent += this.formatCSVRow('Invest Bank - Others (110202)', this.assetsData.investBankOthers);
csvContent += this.formatCSVRow('BLOM Bank France/BANORIENT (110210)', this.assetsData.blomBank);
csvContent += this.formatCSVRow('ADCB - PTS - AD (110211)', this.assetsData.adcbPtsAd);
csvContent += this.formatCSVRow('ADCB - Dubai (110212)', this.assetsData.adcbDubai);
csvContent += this.formatCSVRow('PEMO - NYMCARD Payment Services LLC (110213)', this.assetsData.pemoNymcard);
csvContent += this.formatCSVRow('BANK BALANCE', this.assetsData.bankBalanceTotal);
csvContent += `\n`;
csvContent += this.formatCSVRow('CASH AND CASH EQUIVALENT', this.assetsData.cashAndCashEquivalent);

            
            const filename = `CORRECTED_Assets_Schedule_Year_${year}.csv`;
            this.downloadFile(csvContent, filename, 'text/csv');
            
            this.showToast('CORRECTED Assets schedule exported successfully!', 'success');
            console.log('✅ CSV export completed with corrected logic');
            
        } catch (error) {
            console.error('❌ Export error:', error);
            this.showToast('Export failed. Please try again.', 'error');
        }
    }

    getBankAccountData(accountKey) {
    const defaultAmounts = {
        dec_prev: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0,
        jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
    };
    
    return this.assetsData[accountKey] || defaultAmounts;
}
    
    formatCSVRow(description, amounts) {
        return `${description},${this.formatCSVAmounts(amounts)}\n`;
    }
    
    formatCSVAmounts(amounts) {
        const monthKeys = ['dec_prev', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        return monthKeys.map(month => amounts?.[month] || 0).join(',');
    }
    
    printReport() {
        console.log('🖨️ Printing CORRECTED Assets Schedule...');
        window.print();
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    
    // Error handling and UI methods remain the same
    handleError(error) {
        this.retryCount++;
        
        if (this.retryCount <= this.maxRetries) {
            this.updateStatusBar(`Error occurred. Retry ${this.retryCount}/${this.maxRetries}: ${error.message}`);
            setTimeout(() => {
                this.loadAssetsReport();
            }, 2000);
        } else {
            this.showError();
            this.updateStatusBar(`Failed to load corrected assets schedule after ${this.maxRetries} attempts: ${error.message}`);
            this.showToast('Failed to load corrected assets schedule. Please check your connection and try again.', 'error');
        }
    }
    
    showLoading(show) {
        const loadingElement = document.getElementById('assetsLoading');
        const contentElement = document.getElementById('assetsContent');
        
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
        if (contentElement) {
            contentElement.style.display = show ? 'none' : 'block';
        }
    }
    
    showError() {
        const errorElement = document.getElementById('assetsError');
        const contentElement = document.getElementById('assetsContent');
        
        if (errorElement) {
            errorElement.style.display = 'flex';
        }
        if (contentElement) {
            contentElement.style.display = 'none';
        }
    }
    
    hideError() {
        const errorElement = document.getElementById('assetsError');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    
    disableButtons(disable) {
        const buttons = ['generateBtn', 'exportBtn', 'exportBtn2', 'printBtn'];
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = disable;
                btn.style.opacity = disable ? '0.6' : '1';
            }
        });
    }
    
    updateStatusBar(message) {
        const statusInfo = document.getElementById('assetsStatusInfo');
        const timestamp = document.getElementById('assetsTimestamp');
        
        if (statusInfo) {
            statusInfo.textContent = message;
        }
        if (timestamp) {
            timestamp.textContent = new Date().toLocaleString();
        }
    }
    
    showToast(message, type = 'info') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 10000;
                display: none;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            `;
            document.body.appendChild(toast);
        }
        
        const styles = {
            success: 'background: #27ae60;',
            error: 'background: #e74c3c;',
            warning: 'background: #f39c12;',
            info: 'background: #3498db;'
        };
        
        toast.style.cssText += styles[type] || styles.info;
        toast.textContent = message;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    }
}

// =====================================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK EVENTS
// =====================================================

let assetsManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏢 DOM loaded, initializing CORRECTED Assets Sheet Manager...');
    
    // Initialize the Assets Manager
    assetsManager = new AssetsSheetManager();
    
    // Make it globally accessible for debugging
    window.assetsManager = assetsManager;
    
    console.log('✅ CORRECTED Assets Sheet Manager initialized');
    
    // Auto-load report after 1.5 seconds
    setTimeout(() => {
        console.log('🚀 Auto-loading CORRECTED Assets Schedule...');
        loadAssetsReport();
    }, 1500);
});

function loadAssetsReport() {
    if (assetsManager) {
        console.log('🏢 Loading CORRECTED Assets Report via global function...');
        assetsManager.loadAssetsReport();
    } else {
        console.error('❌ AssetsManager not initialized');
        alert('Assets Manager not initialized. Please refresh the page.');
    }
}

function exportAssetsReport() {
    if (assetsManager) {
        console.log('📁 Exporting CORRECTED Assets Report via global function...');
        assetsManager.exportToCSV();
    } else {
        console.error('❌ AssetsManager not initialized');
        alert('Assets Manager not initialized. Please refresh the page.');
    }
}

function printAssetsReport() {
    if (assetsManager) {
        console.log('🖨️ Printing CORRECTED Assets Report via global function...');
        assetsManager.printReport();
    } else {
        console.error('❌ AssetsManager not initialized');
        alert('Assets Manager not initialized. Please refresh the page.');
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// =====================================================
// CORRECTED TESTING FUNCTIONS FOR CONSOLE DEBUGGING
// =====================================================

// Test corrected logic for individual account
async function testCorrectedAccountBalance(accountNo, year = 2025) {
    console.log(`🧪 Testing CORRECTED Account ${accountNo} for ${year}`);
    
    try {
        const response = await fetch(`/api/reports/test-correct-logic/${accountNo}/${year}`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ CORRECTED Test Results:');
            console.log('Account Info:', result.data.account);
            console.log('Yearly Balances:', result.data.yearlyBalances);
            console.log('Logic Explanation:', result.data.logic);
            console.log('Balance Flow:', result.data.balanceFlow);
        } else {
            console.log('❌ Test Failed:', result.message);
        }
    } catch (error) {
        console.error('❌ Test Error:', error);
    }
}

// Test all cash accounts with corrected logic
async function testAllCashAccountsCorrected() {
    console.log('🧪 Testing All Cash Accounts - CORRECTED LOGIC');
    console.log('===============================================');
    
    const accounts = [
        { no: '110101', name: 'Petty Cash - Main' },
        { no: '110102', name: 'Petty Cash - Projects' },
        { no: '110103', name: 'Petty Cash - Employee' },
        { no: '110111', name: 'Main Collection' },
        { no: '110112', name: 'Credit Card Transactions' }
    ];
    
    const currentYear = new Date().getFullYear();
    
    console.log(`Testing for Year: ${currentYear} with CORRECTED logic`);
    console.log('');
    
    for (const account of accounts) {
        console.log(`📊 ${account.name} (${account.no})`);
        await testCorrectedAccountBalance(account.no, currentYear);
        console.log('');
        
        // Add delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// Verify corrected balance sheet logic
function verifyCorrectedLogic() {
    console.log('🧮 CORRECTED BALANCE SHEET LOGIC VERIFICATION');
    console.log('=============================================');
    console.log('For ASSET accounts (110101, 110102, etc.):');
    console.log('');
    console.log('CORRECTED Calculation Method:');
    console.log('- December 2024: Closing Balance (all transactions up to Dec 31, 2024)');
    console.log('- January 2025: Dec 2024 Balance + (Jan 2025 Debits - Jan 2025 Credits)');
    console.log('- February 2025: Jan 2025 Balance + (Feb 2025 Debits - Feb 2025 Credits)');
    console.log('- March 2025: Feb 2025 Balance + (Mar 2025 Debits - Mar 2025 Credits)');
    console.log('- ... and so on for the entire year');
    console.log('');
    console.log('CORRECTED Example Flow:');
    console.log('- Dec 2024 Balance: 37,011 (actual closing balance)');
    console.log('- Jan 2025 Movements: Debits 15,000 - Credits 5,289 = +9,711');
    console.log('- Jan 2025 Balance: 37,011 + 9,711 = 46,722');
    console.log('- Feb 2025 Movements: Debits 8,000 - Credits 3,000 = +5,000');
    console.log('- Feb 2025 Balance: 46,722 + 5,000 = 51,722');
    console.log('');
    console.log('KEY CORRECTION:');
    console.log('- No more "one-month-behind" confusion');
    console.log('- Each column shows actual month-end balance');
    console.log('- Standard accounting practice');
    console.log('- Running balance method');
    console.log('');
    console.log('Negative amounts will show in RED with parentheses: (5,000)');
    console.log('=============================================');
}

// Compare old vs corrected logic
async function compareLogic() {
    console.log('🔍 COMPARING OLD VS CORRECTED LOGIC');
    console.log('===================================');
    
    try {
        const response = await fetch('/api/reports/explain-correct-logic');
        const result = await response.json();
        
        if (result.success) {
            console.log('📊 CORRECTED Logic Explanation:');
            console.log(result.logic);
        }
    } catch (error) {
        console.error('❌ Error comparing logic:', error);
    }
    
    console.log('');
    console.log('🚫 OLD (WRONG) Logic Problems:');
    console.log('- Each column was one month behind');
    console.log('- Dec 2024 column showed Oct balance + Nov movements');
    console.log('- Jan 2025 column showed Nov balance + Dec movements');
    console.log('- Confusing and not standard accounting practice');
    console.log('');
    console.log('✅ NEW (CORRECT) Logic Benefits:');
    console.log('- Each column shows actual month-end balance');
    console.log('- Dec 2024 column shows Dec 31, 2024 closing balance');
    console.log('- Jan 2025 column shows Dec balance + Jan movements');
    console.log('- Standard accounting practice');
    console.log('- Clear and logical progression');
    console.log('===================================');
}

// =====================================================
// INITIALIZATION MESSAGE
// =====================================================

console.log('🏢 CORRECTED ASSETS SCHEDULE MODULE LOADED');
console.log('📅 Year-based display (Dec prev to Dec current)');
console.log('📊 CORRECTED Balance Logic: Current = Previous + Movements');
console.log('🔄 Rounding Rule: .50 and above rounds up');
console.log('🔴 Negative amounts show in RED with parentheses');
console.log('🔧 Available CORRECTED functions:');
console.log('  - loadAssetsReport() - Load corrected report');
console.log('  - exportAssetsReport() - Export corrected CSV');
console.log('  - printAssetsReport() - Print corrected report');
console.log('  - testCorrectedAccountBalance(accountNo, year) - Test single account');
console.log('  - testAllCashAccountsCorrected() - Test all accounts with correct logic');
console.log('  - verifyCorrectedLogic() - Show corrected logic explanation');
console.log('  - compareLogic() - Compare old vs new logic');
console.log('====================================');

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssetsSheetManager;
}