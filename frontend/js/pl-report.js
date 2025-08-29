// =====================================================
// P&L REPORT JAVASCRIPT - COMPLETE VERSION
// File: frontend/js/pl-report.js
// Uses the new backend API endpoints
// =====================================================

class PLReportManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth() + 1;
        this.reportData = {};
        this.isLoading = false;
        
        this.init();
    }
    
    init() {
        console.log('📊 Initializing P&L Report Manager...');
        this.bindEvents();
    }
    
    bindEvents() {
        console.log('✅ P&L Report events bound successfully');
    }
    
    async loadPLReport() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        this.hideError();
        
        try {
            const year = parseInt(document.getElementById('plYear').value);
            const month = parseInt(document.getElementById('plMonth').value);
            
            console.log(`📊 Loading P&L Report for ${year}-${month}...`);
            
            // Get data from the three new API endpoints
            const [actualData, cumulativeData, previousData] = await Promise.all([
                this.fetchData(`/api/reports/pl-summary/${year}/${month}`),
                this.fetchData(`/api/reports/pl-cumulative/${year}/${month}`),
                this.fetchData(`/api/reports/pl-previous/${year}/${month}`)
            ]);
            
            // Process the data into display format
            this.reportData = this.combineReportData(actualData, cumulativeData, previousData);
            
            // Render the report
            this.renderReport();
            
            this.updateStatusBar(`Report generated for ${this.getMonthName(month)} ${year}`);
            
        } catch (error) {
            console.error('❌ Error loading P&L report:', error);
            this.showError();
            this.updateStatusBar('Error generating report');
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }
    
    async fetchData(endpoint) {
        const response = await fetch(endpoint);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch data');
        }
        
        return result.data;
    }
    
    combineReportData(actualData, cumulativeData, previousData) {
        console.log('🔄 Combining report data...');
        
        // Create a map of all unique accounts
        const accountMap = new Map();
        
        // Helper function to add accounts to map
        const addAccountsToMap = (accounts, type) => {
            accounts.forEach(account => {
                const key = account.account_number;
                if (!accountMap.has(key)) {
                    accountMap.set(key, {
                        account_number: account.account_number,
                        account_name: account.account_name,
                        type: type,
                        amounts: { actual: 0, cumulative: 0, previous: 0 }
                    });
                }
            });
        };
        
        // Add accounts from all periods
        addAccountsToMap(actualData.revenue.accounts, 'REVENUE');
        addAccountsToMap(actualData.directCosts.accounts, 'DIRECT_COST');
        addAccountsToMap(actualData.expenses.accounts, 'EXPENSES');
        
        addAccountsToMap(cumulativeData.revenue.accounts, 'REVENUE');
        addAccountsToMap(cumulativeData.directCosts.accounts, 'DIRECT_COST');
        addAccountsToMap(cumulativeData.expenses.accounts, 'EXPENSES');
        
        addAccountsToMap(previousData.revenue.accounts, 'REVENUE');
        addAccountsToMap(previousData.directCosts.accounts, 'DIRECT_COST');
        addAccountsToMap(previousData.expenses.accounts, 'EXPENSES');
        
        // Helper function to populate amounts
        const populateAmounts = (accounts, period) => {
            accounts.forEach(account => {
                const key = account.account_number;
                if (accountMap.has(key)) {
                    accountMap.get(key).amounts[period] = parseFloat(account.net_amount || 0);
                }
            });
        };
        
        // Populate amounts for each period
        populateAmounts(actualData.revenue.accounts, 'actual');
        populateAmounts(actualData.directCosts.accounts, 'actual');
        populateAmounts(actualData.expenses.accounts, 'actual');
        
        populateAmounts(cumulativeData.revenue.accounts, 'cumulative');
        populateAmounts(cumulativeData.directCosts.accounts, 'cumulative');
        populateAmounts(cumulativeData.expenses.accounts, 'cumulative');
        
        populateAmounts(previousData.revenue.accounts, 'previous');
        populateAmounts(previousData.directCosts.accounts, 'previous');
        populateAmounts(previousData.expenses.accounts, 'previous');
        
        // Group accounts by category
        const report = {
            REVENUE: { accounts: [], total: { actual: 0, cumulative: 0, previous: 0 } },
            DIRECT_COST: { accounts: [], total: { actual: 0, cumulative: 0, previous: 0 } },
            EXPENSES: { accounts: [], total: { actual: 0, cumulative: 0, previous: 0 } }
        };
        
        // Populate report structure
        accountMap.forEach(account => {
            if (account.type === 'REVENUE') {
                report.REVENUE.accounts.push(account);
                report.REVENUE.total.actual += account.amounts.actual;
                report.REVENUE.total.cumulative += account.amounts.cumulative;
                report.REVENUE.total.previous += account.amounts.previous;
            } else if (account.type === 'DIRECT_COST') {
                report.DIRECT_COST.accounts.push(account);
                report.DIRECT_COST.total.actual += account.amounts.actual;
                report.DIRECT_COST.total.cumulative += account.amounts.cumulative;
                report.DIRECT_COST.total.previous += account.amounts.previous;
            } else if (account.type === 'EXPENSES') {
                report.EXPENSES.accounts.push(account);
                report.EXPENSES.total.actual += account.amounts.actual;
                report.EXPENSES.total.cumulative += account.amounts.cumulative;
                report.EXPENSES.total.previous += account.amounts.previous;
            }
        });
        
        // Sort accounts within each category by account number
        report.REVENUE.accounts.sort((a, b) => a.account_number.localeCompare(b.account_number));
        report.DIRECT_COST.accounts.sort((a, b) => a.account_number.localeCompare(b.account_number));
        report.EXPENSES.accounts.sort((a, b) => a.account_number.localeCompare(b.account_number));
        
        // Calculate derived totals
        report.GROSS_PROFIT = {
            total: {
                actual: report.REVENUE.total.actual - report.DIRECT_COST.total.actual,
                cumulative: report.REVENUE.total.cumulative - report.DIRECT_COST.total.cumulative,
                previous: report.REVENUE.total.previous - report.DIRECT_COST.total.previous
            }
        };
        
        report.NET_PROFIT = {
            total: {
                actual: report.GROSS_PROFIT.total.actual - report.EXPENSES.total.actual,
                cumulative: report.GROSS_PROFIT.total.cumulative - report.EXPENSES.total.cumulative,
                previous: report.GROSS_PROFIT.total.previous - report.EXPENSES.total.previous
            }
        };
        
        return report;
    }
    
    renderReport() {
        console.log('Rendering P&L report...');
        
        const tbody = document.getElementById('plTableBody');
        let html = '';
        
        // REVENUE Section
        html += this.renderSection('REVENUE', 'REVENUE', this.reportData.REVENUE);
        
        // DIRECT COST Section  
        html += this.renderSection('DIRECT_COST', 'DIRECT COST', this.reportData.DIRECT_COST);
        
        // GROSS PROFIT
        html += this.renderTotalRow('TOTAL GROSS PROFIT', this.reportData.GROSS_PROFIT.total, 'pl-total-row');
        
        // EXPENSES Section
        html += this.renderSection('EXPENSES', 'EXPENSES', this.reportData.EXPENSES);
        
        // NET PROFIT
        html += this.renderTotalRow('TOTAL NET PROFIT', this.reportData.NET_PROFIT.total, 'pl-grand-total-row');
        
        tbody.innerHTML = html;
        
        // Show content
        document.getElementById('plContent').style.display = 'block';
        
        console.log('P&L report rendered successfully');
    }
    
    renderSection(sectionKey, sectionTitle, sectionData) {
        let html = '';
        
        // Section header
        html += `
            <tr class="pl-category-header">
                <td colspan="8">${sectionTitle}</td>
            </tr>
        `;
        
        // Account rows
        if (sectionData.accounts && sectionData.accounts.length > 0) {
            sectionData.accounts.forEach(account => {
                const amounts = account.amounts;
                
                // Only show accounts with non-zero amounts
                if (amounts.actual !== 0 || amounts.cumulative !== 0 || amounts.previous !== 0) {
                    html += `
                        <tr class="pl-account-row">
                            <td><span class="account-number">${account.account_number}</span></td>
                            <td><span class="account-name">${account.account_name || 'Unnamed Account'}</span></td>
                            <td class="amount-cell">${this.formatAmount(amounts.actual)}</td>
                            <td class="amount-cell">${this.formatAmount(amounts.cumulative)}</td>
                            <td class="amount-cell">${this.formatAmount(amounts.previous)}</td>
                            <td class="amount-cell">-</td>
                            <td class="amount-cell">-</td>
                            <td class="amount-cell">-</td>
                        </tr>
                    `;
                }
            });
        }
        
        // Section total
        html += this.renderTotalRow(`TOTAL ${sectionTitle}`, sectionData.total, 'pl-subcategory-header');
        
        return html;
    }
    
    renderTotalRow(title, totals, cssClass) {
        return `
            <tr class="${cssClass}">
                <td></td>
                <td><strong>${title}</strong></td>
                <td class="amount-cell"><strong>${this.formatAmount(totals.actual)}</strong></td>
                <td class="amount-cell"><strong>${this.formatAmount(totals.cumulative)}</strong></td>
                <td class="amount-cell"><strong>${this.formatAmount(totals.previous)}</strong></td>
                <td class="amount-cell"><strong>-</strong></td>
                <td class="amount-cell"><strong>-</strong></td>
                <td class="amount-cell"><strong>-</strong></td>
            </tr>
        `;
    }
    
    formatAmount(amount) {
        if (!amount || amount === 0) {
            return '<span class="amount-zero">-</span>';
        }
        
        const formatted = Math.abs(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        const cssClass = amount > 0 ? 'amount-positive' : 'amount-negative';
        const display = amount < 0 ? `(${formatted})` : formatted;
        
        return `<span class="${cssClass}">${display}</span>`;
    }
    
    // Export functionality
    exportToExcel() {
        console.log('Exporting P&L report...');
        
        if (!this.reportData || Object.keys(this.reportData).length === 0) {
            alert('No report data to export. Please generate a report first.');
            return;
        }
        
        const year = document.getElementById('plYear').value;
        const month = document.getElementById('plMonth').value;
        const monthName = this.getMonthName(parseInt(month));
        
        // Create CSV content
        let csvContent = `PROFIT & LOSS STATEMENT\n`;
        csvContent += `For the Month Ended ${monthName} ${year}\n\n`;
        csvContent += `Account,Particulars,Actual,Accum System,Last Report MIS,Budget,Variance,Last Year\n`;
        
        // Add sections
        this.addCSVSection(csvContent, 'REVENUE', this.reportData.REVENUE);
        this.addCSVSection(csvContent, 'DIRECT COST', this.reportData.DIRECT_COST);
        
        // Add gross profit
        csvContent += `,"TOTAL GROSS PROFIT",${this.reportData.GROSS_PROFIT.total.actual},${this.reportData.GROSS_PROFIT.total.cumulative},${this.reportData.GROSS_PROFIT.total.previous},-,-,-\n\n`;
        
        this.addCSVSection(csvContent, 'EXPENSES', this.reportData.EXPENSES);
        
        // Add net profit
        csvContent += `,"TOTAL NET PROFIT",${this.reportData.NET_PROFIT.total.actual},${this.reportData.NET_PROFIT.total.cumulative},${this.reportData.NET_PROFIT.total.previous},-,-,-\n`;
        
        // Download file
        const filename = `PL_Report_${monthName}_${year}.csv`;
        this.downloadCSV(csvContent, filename);
        
        console.log('P&L report exported successfully');
    }
    
    addCSVSection(csvContent, title, sectionData) {
        csvContent += `${title}\n`;
        
        if (sectionData.accounts) {
            sectionData.accounts.forEach(account => {
                const amounts = account.amounts;
                if (amounts.actual !== 0 || amounts.cumulative !== 0 || amounts.previous !== 0) {
                    csvContent += `${account.account_number},"${account.account_name}",${amounts.actual},${amounts.cumulative},${amounts.previous},-,-,-\n`;
                }
            });
        }
        
        csvContent += `,"TOTAL ${title}",${sectionData.total.actual},${sectionData.total.cumulative},${sectionData.total.previous},-,-,-\n\n`;
        
        return csvContent;
    }
    
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    
    // Utility Methods
    showLoading(show) {
        document.getElementById('plLoading').style.display = show ? 'flex' : 'none';
        document.getElementById('plContent').style.display = show ? 'none' : 'block';
    }
    
    showError() {
        document.getElementById('plError').style.display = 'flex';
        document.getElementById('plContent').style.display = 'none';
    }
    
    hideError() {
        document.getElementById('plError').style.display = 'none';
    }
    
    updateStatusBar(message) {
        document.getElementById('plStatusInfo').textContent = message;
        document.getElementById('plTimestamp').textContent = new Date().toLocaleString();
    }
    
    getMonthName(monthNumber) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthNumber - 1];
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing P&L Report Manager...');
    window.plManager = new PLReportManager();
});

// Global functions for HTML onclick events
window.loadPLReport = () => {
    if (window.plManager) {
        window.plManager.loadPLReport();
    }
};

window.exportPLReport = () => {
    if (window.plManager) {
        window.plManager.exportToExcel();
    }
};

console.log('P&L Report JavaScript module loaded successfully');