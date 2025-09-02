// =====================================================
// COMPLETE ASSETS SCHEDULE JAVASCRIPT MODULE
// Complete client-side functionality for Assets management
// File: frontend/js/assets-sheet.js
// =====================================================

class AssetsSheetManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth() + 1;
        this.assetsData = {};
        this.isLoading = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.init();
    }
    
    init() {
        console.log('🏢 Initializing Assets Sheet Manager...');
        this.bindEvents();
        this.setupScrollIndicator();
        this.setCurrentDate();
    }
    
    bindEvents() {
        document.getElementById('assetsYear').addEventListener('change', () => {
            this.updateReportHeader();
        });
        
        document.getElementById('assetsMonth').addEventListener('change', () => {
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
    
    setCurrentDate() {
        const now = new Date();
        document.getElementById('assetsYear').value = now.getFullYear();
        document.getElementById('assetsMonth').value = now.getMonth() + 1;
        this.updateReportHeader();
    }
    
    updateReportHeader() {
        const year = document.getElementById('assetsYear').value;
        const month = document.getElementById('assetsMonth').value;
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const monthName = monthNames[month - 1];
        
        document.getElementById('assetsReportPeriod').textContent = 
            `As of ${monthName} ${year}`;
            
        // Update table headers to show proper month sequence
        this.updateTableHeaders(year, month);
    }
    
    updateTableHeaders(year, month) {
        const headers = document.querySelectorAll('.assets-table th.month-header');
        const monthNames = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        
        // Start from December of previous year
        const startYear = parseInt(year) - 1;
        let currentYear = startYear;
        
        headers.forEach((header, index) => {
            if (index === 0) {
                // First column is always December of previous year
                header.textContent = `DEC-${currentYear.toString().slice(-2)}`;
            } else {
                // Subsequent months
                if (index >= 13) { // December of current year
                    currentYear = parseInt(year);
                }
                header.textContent = `${monthNames[index]}-${currentYear.toString().slice(-2)}`;
            }
        });
    }
    
    async loadAssetsReport() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        this.hideError();
        this.disableButtons(true);
        
        try {
            const year = parseInt(document.getElementById('assetsYear').value);
            const month = parseInt(document.getElementById('assetsMonth').value);
            
            console.log(`🏢 Loading Assets Schedule for ${year}-${month}...`);
            this.updateStatusBar('Loading assets data...');
            
            const response = await fetch(`/api/reports/assets-schedule/${year}/${month}`);
            
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
            this.updateStatusBar(`Assets schedule generated successfully for ${this.getMonthName(month)} ${year}`);
            
            this.retryCount = 0;
            console.log('✅ Assets Schedule loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading assets schedule:', error);
            this.handleError(error);
        } finally {
            this.isLoading = false;
            this.showLoading(false);
            this.disableButtons(false);
        }
    }
    
    validateAndProcessData(data) {
        console.log('🔍 Validating and processing assets data...');
        
        // Define default monthly amounts structure
        const defaultMonthlyAmounts = {
            dec: 0, jan: 0, feb: 0, mar: 0, apr: 0, may: 0,
            jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec_end: 0
        };
        
        const processedData = {
            // Current Assets
            pettyCash: data.pettyCash || defaultMonthlyAmounts,
            pettyCashProjects: data.pettyCashProjects || defaultMonthlyAmounts,
            pettyCashAdmin: data.pettyCashAdmin || defaultMonthlyAmounts,
            mainCollection: data.mainCollection || defaultMonthlyAmounts,
            overdraftTransactions: data.overdraftTransactions || defaultMonthlyAmounts,
            cashTotalCurrent: data.cashTotalCurrent || defaultMonthlyAmounts,
            
            // Investments
            investmentBank: data.investmentBank || defaultMonthlyAmounts,
            
            // Bank Balances
            blomBankPrincipal: data.blomBankPrincipal || defaultMonthlyAmounts,
            blomBankFixedDeposit: data.blomBankFixedDeposit || defaultMonthlyAmounts,
            adcbDubai: data.adcbDubai || defaultMonthlyAmounts,
            chaseAccountSaver: data.chaseAccountSaver || defaultMonthlyAmounts,
            chaseAccountPayment: data.chaseAccountPayment || defaultMonthlyAmounts,
            bankBalancesTotalCurrent: data.bankBalancesTotalCurrent || defaultMonthlyAmounts,
            bankAndCashEquivalent: data.bankAndCashEquivalent || defaultMonthlyAmounts,
            
            // Margin & Performance Guarantees
            marginPerformanceGuarantees: data.marginPerformanceGuarantees || defaultMonthlyAmounts,
            fixedDepositsUnderLien: data.fixedDepositsUnderLien || defaultMonthlyAmounts,
            bankMarginDeposits: data.bankMarginDeposits || defaultMonthlyAmounts,
            
            // Clients & Balances
            clientsCertifiedWorks: data.clientsCertifiedWorks || defaultMonthlyAmounts,
            clientsAdvance: data.clientsAdvance || defaultMonthlyAmounts,
            clientsNonCollectible: data.clientsNonCollectible || defaultMonthlyAmounts,
            clientsProjectWorks: data.clientsProjectWorks || defaultMonthlyAmounts,
            clientsMaintenanceClients: data.clientsMaintenanceClients || defaultMonthlyAmounts,
            otherClients: data.otherClients || defaultMonthlyAmounts,
            lessProvision: data.lessProvision || defaultMonthlyAmounts,
            lessReceivables: data.lessReceivables || defaultMonthlyAmounts,
            clientsTotal: data.clientsTotal || defaultMonthlyAmounts,
            
            // Retention Works
            retentionCertifiedWorks: data.retentionCertifiedWorks || defaultMonthlyAmounts,
            retentionProjectWorks: data.retentionProjectWorks || defaultMonthlyAmounts,
            lessProvisionRetention: data.lessProvisionRetention || defaultMonthlyAmounts,
            
            // Other Related Parties
            otherRelatedPartiesPhoenician: data.otherRelatedPartiesPhoenician || defaultMonthlyAmounts,
            
            // Calculate totals
            totalCurrentAssets: this.calculateRowTotals([
                data.cashTotalCurrent,
                data.bankBalancesTotalCurrent,
                data.clientsTotal,
                data.retentionCertifiedWorks,
                data.otherRelatedPartiesPhoenician
            ])
        };
        
        return processedData;
    }
    
    calculateRowTotals(dataRows) {
        const months = ['dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec_end'];
        const totals = {};
        
        months.forEach(month => {
            totals[month] = dataRows.reduce((sum, row) => {
                return sum + (row && row[month] ? parseFloat(row[month]) || 0 : 0);
            }, 0);
        });
        
        return totals;
    }
    
    renderAssetsReport() {
        console.log('🏢 Rendering Assets Schedule...');
        
        const tbody = document.getElementById('assetsTableBody');
        let html = '';
        
        try {
            // Cash Section
            html += this.renderCategoryHeader('Cash');
            html += this.renderDataRow('110101', 'Petty Cash - Main (110101)', this.assetsData.pettyCash);
            html += this.renderDataRow('110102', 'Petty Cash - Projects, P&D, Visit (110102)', this.assetsData.pettyCashProjects);
            html += this.renderDataRow('110103', 'Petty Cash - Admin (110103)', this.assetsData.pettyCashAdmin);
            html += this.renderDataRow('110111', 'Main Collection (110111)', this.assetsData.mainCollection);
            html += this.renderDataRow('110112', 'Overdraft Transactions (110112)', this.assetsData.overdraftTransactions);
            html += this.renderSubtotalRow('Cash', this.assetsData.cashTotalCurrent);
            
            // Investment Bank Section
            html += this.renderCategoryHeader('Investment Bank');
            html += this.renderDataRow('', 'Investment Bank', this.assetsData.investmentBank);
            
            // Bank Balances Section
            html += this.renderCategoryHeader('Bank Balances');
            html += this.renderDataRow('', 'BLOM Bank Principal RAGHFIKENT', this.assetsData.blomBankPrincipal);
            html += this.renderDataRow('', 'BLOM Bank Fixed Deposit RAGHFIKENT', this.assetsData.blomBankFixedDeposit);
            html += this.renderDataRow('', 'ADCB - Dubai', this.assetsData.adcbDubai);
            html += this.renderDataRow('', 'Chase (Account Saver)', this.assetsData.chaseAccountSaver);
            html += this.renderDataRow('', 'Chase (Account Payment Services LLC)', this.assetsData.chaseAccountPayment);
            html += this.renderSubtotalRow('Bank Balances', this.assetsData.bankBalancesTotalCurrent);
            html += this.renderTotalRow('Bank And Cash Equivalent', this.assetsData.bankAndCashEquivalent);
            
            // Margin & Performance Section
            html += this.renderCategoryHeader('Margin & Performance & Advance Guarantees');
            html += this.renderDataRow('112108', 'Margin & Performance & Advance Guarantees', this.assetsData.marginPerformanceGuarantees);
            html += this.renderDataRow('112111', 'Fixed Deposits Under Lien', this.assetsData.fixedDepositsUnderLien);
            html += this.renderDataRow('', 'Bank Margin Deposits', this.assetsData.bankMarginDeposits);
            
            // Clients Section
            html += this.renderCategoryHeader('Clients');
            html += this.renderDataRow('111101', 'Clients (Certified Works)', this.assetsData.clientsCertifiedWorks);
            html += this.renderDataRow('111115', 'Clients (Advance)', this.assetsData.clientsAdvance);
            html += this.renderDataRow('', 'Clients (Non-collectible)', this.assetsData.clientsNonCollectible);
            html += this.renderDataRow('111109', 'Clients (Project Works)', this.assetsData.clientsProjectWorks);
            html += this.renderDataRow('111105', 'Maintenance Clients', this.assetsData.clientsMaintenanceClients);
            html += this.renderDataRow('111111', 'Other Clients', this.assetsData.otherClients);
            html += this.renderDataRow('111103/111114', 'Less: Provision (Certified Works)', this.assetsData.lessProvision);
            html += this.renderDataRow('111106', 'Less: Provision Against (IF Un-Certified Works)', this.assetsData.lessReceivables);
            html += this.renderSubtotalRow('Clients', this.assetsData.clientsTotal);
            
            // Retention Section
            html += this.renderCategoryHeader('Retention');
            html += this.renderDataRow('', 'Retention (Certified Works)', this.assetsData.retentionCertifiedWorks);
            html += this.renderDataRow('', 'Retention (IF Un-Certified Works)', this.assetsData.retentionProjectWorks);
            html += this.renderDataRow('', 'Less: Prov for Impairment of Trade Receivables', this.assetsData.lessProvisionRetention);
            
            // Other Related Parties
            html += this.renderCategoryHeader('Other Related Parties');
            html += this.renderDataRow('112501', 'Due from Related Parties Al Phoenician Nursery', this.assetsData.otherRelatedPartiesPhoenician);
            
            // Total Current Assets
            html += this.renderTotalRow('TOTAL CURRENT ASSETS', this.assetsData.totalCurrentAssets);
            
            tbody.innerHTML = html;
            document.getElementById('assetsContent').style.display = 'block';
            
            console.log('✅ Assets Schedule rendered successfully');
            
        } catch (renderError) {
            console.error('❌ Error rendering assets schedule:', renderError);
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
        const monthKeys = ['dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec_end'];
        
        let accountNoDisplay = accountNo ? `<span class="account-number">${accountNo}</span><br>` : '';
        
        return `
            <tr class="assets-data-row">
                <td>${accountNoDisplay}${description}</td>
                ${monthKeys.map(month => 
                    `<td class="amount-cell">${this.formatAmount(amounts?.[month] || 0)}</td>`
                ).join('')}
            </tr>
        `;
    }
    
    renderSubtotalRow(title, amounts) {
        const monthKeys = ['dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec_end'];
        
        return `
            <tr class="assets-subtotal-row">
                <td><strong>${title}</strong></td>
                ${monthKeys.map(month => 
                    `<td class="amount-cell"><strong>${this.formatAmount(amounts?.[month] || 0)}</strong></td>`
                ).join('')}
            </tr>
        `;
    }
    
    renderTotalRow(title, amounts) {
        const monthKeys = ['dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec_end'];
        
        return `
            <tr class="assets-total-row">
                <td><strong>${title}</strong></td>
                ${monthKeys.map(month => 
                    `<td class="amount-cell"><strong>${this.formatAmount(amounts?.[month] || 0)}</strong></td>`
                ).join('')}
            </tr>
        `;
    }
    
    formatAmount(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount === 0) {
            return '<span class="amount-zero">-</span>';
        }
        
        const formatted = Math.abs(numAmount).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        const cssClass = numAmount > 0 ? 'amount-positive' : 'amount-negative';
        const display = numAmount < 0 ? `(${formatted})` : formatted;
        
        return `<span class="${cssClass}">${display}</span>`;
    }
    
    async exportToCSV() {
        console.log('📁 Exporting Assets Schedule to CSV...');
        
        if (!this.assetsData || Object.keys(this.assetsData).length === 0) {
            this.showToast('No assets data to export. Please generate a report first.', 'warning');
            return;
        }
        
        try {
            const year = document.getElementById('assetsYear').value;
            const month = document.getElementById('assetsMonth').value;
            const monthName = this.getMonthName(parseInt(month));
            
            let csvContent = `ASSETS SCHEDULE\n`;
            csvContent += `As of ${monthName} ${year}\n\n`;
            csvContent += `Particulars,DEC-${parseInt(year)-1},JAN-${year},FEB-${year},MAR-${year},APR-${year},MAY-${year},JUN-${year},JUL-${year},AUG-${year},SEP-${year},OCT-${year},NOV-${year},DEC-${year}\n`;
            
            // Add cash section
            csvContent += `\nCASH\n`;
            csvContent += this.formatCSVRow('Petty Cash - Main (110101)', this.assetsData.pettyCash);
            csvContent += this.formatCSVRow('Petty Cash - Projects (110102)', this.assetsData.pettyCashProjects);
            csvContent += this.formatCSVRow('Petty Cash - Admin (110103)', this.assetsData.pettyCashAdmin);
            csvContent += this.formatCSVRow('Main Collection (110111)', this.assetsData.mainCollection);
            csvContent += this.formatCSVRow('Overdraft Transactions (110112)', this.assetsData.overdraftTransactions);
            csvContent += this.formatCSVRow('CASH TOTAL', this.assetsData.cashTotalCurrent);
            
            // Add bank balances section
            csvContent += `\nBANK BALANCES\n`;
            csvContent += this.formatCSVRow('BLOM Bank Principal', this.assetsData.blomBankPrincipal);
            csvContent += this.formatCSVRow('BLOM Bank Fixed Deposit', this.assetsData.blomBankFixedDeposit);
            csvContent += this.formatCSVRow('ADCB - Dubai', this.assetsData.adcbDubai);
            csvContent += this.formatCSVRow('Chase Account Saver', this.assetsData.chaseAccountSaver);
            csvContent += this.formatCSVRow('Chase Payment Services', this.assetsData.chaseAccountPayment);
            csvContent += this.formatCSVRow('BANK BALANCES TOTAL', this.assetsData.bankBalancesTotalCurrent);
            
            // Add clients section
            csvContent += `\nCLIENTS\n`;
            csvContent += this.formatCSVRow('Clients (Certified Works)', this.assetsData.clientsCertifiedWorks);
            csvContent += this.formatCSVRow('Clients (Advance)', this.assetsData.clientsAdvance);
            csvContent += this.formatCSVRow('Clients (Project Works)', this.assetsData.clientsProjectWorks);
            csvContent += this.formatCSVRow('Maintenance Clients', this.assetsData.clientsMaintenanceClients);
            csvContent += this.formatCSVRow('CLIENTS TOTAL', this.assetsData.clientsTotal);
            
            csvContent += `\nTOTAL CURRENT ASSETS,${this.formatCSVAmounts(this.assetsData.totalCurrentAssets)}\n`;
            
            const filename = `Assets_Schedule_${monthName}_${year}.csv`;
            this.downloadFile(csvContent, filename, 'text/csv');
            
            this.showToast('Assets schedule exported successfully!', 'success');
            console.log('✅ CSV export completed');
            
        } catch (error) {
            console.error('❌ Export error:', error);
            this.showToast('Export failed. Please try again.', 'error');
        }
    }
    
    formatCSVRow(description, amounts) {
        return `${description},${this.formatCSVAmounts(amounts)}\n`;
    }
    
    formatCSVAmounts(amounts) {
        const monthKeys = ['dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec_end'];
        return monthKeys.map(month => amounts?.[month] || 0).join(',');
    }
    
    printReport() {
        console.log('🖨️ Printing Assets Schedule...');
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
    
    handleError(error) {
        this.retryCount++;
        
        if (this.retryCount <= this.maxRetries) {
            this.updateStatusBar(`Error occurred. Retry ${this.retryCount}/${this.maxRetries}: ${error.message}`);
            setTimeout(() => {
                this.loadAssetsReport();
            }, 2000);
        } else {
            this.showError();
            this.updateStatusBar(`Failed to load assets schedule after ${this.maxRetries} attempts: ${error.message}`);
            this.showToast('Failed to load assets schedule. Please check your connection and try again.', 'error');
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
    
    getMonthName(monthNumber) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthNumber - 1] || 'Unknown';
    }
}

// =====================================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK EVENTS
// =====================================================

let assetsManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏢 DOM loaded, initializing Assets Sheet Manager...');
    
    // Initialize the Assets Manager
    assetsManager = new AssetsSheetManager();
    
    // Make it globally accessible for debugging
    window.assetsManager = assetsManager;
    
    console.log('✅ Assets Sheet Manager initialized');
});

function loadAssetsReport() {
    if (assetsManager) {
        console.log('🏢 Loading Assets Report via global function...');
        assetsManager.loadAssetsReport();
    } else {
        console.error('❌ AssetsManager not initialized');
        alert('Assets Manager not initialized. Please refresh the page.');
    }
}

function exportAssetsReport() {
    if (assetsManager) {
        console.log('📁 Exporting Assets Report via global function...');
        assetsManager.exportToCSV();
    } else {
        console.error('❌ AssetsManager not initialized');
        alert('Assets Manager not initialized. Please refresh the page.');
    }
}

function printAssetsReport() {
    if (assetsManager) {
        console.log('🖨️ Printing Assets Report via global function...');
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
// INITIALIZATION MESSAGE
// =====================================================

console.log('🏢 COMPLETE ASSETS SCHEDULE MODULE LOADED');
console.log('📊 Ready to load assets data from backend API');
console.log('🔧 Available functions: loadAssetsReport(), exportAssetsReport(), printAssetsReport()');

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssetsSheetManager;
}