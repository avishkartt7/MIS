// =====================================================
// UPDATED P&L REPORT JAVASCRIPT - TEMPLATE FORMAT
// File: frontend/js/pl-report.js (REPLACE EXISTING)
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
            
            // Get summary data from new API endpoint
            const response = await fetch(`/api/reports/pl-complete/${year}/${month}`);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch P&L data');
            }
            
            this.reportData = result.data;
            
            // Render the report in Excel template format
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
    
    renderReport() {
    console.log('Rendering P&L report...');
    
    const tbody = document.getElementById('plTableBody');
    let html = '';
    
    try {
        // REVENUE Section (NO blank row above)
        html += this.renderCategoryHeader('REVENUE');
        html += this.renderDataRow('REVENUE', this.reportData.revenue);
        
        // DIRECT COST Section (NO blank row between Revenue and Direct Payroll)
        html += this.renderDataRow('Direct Payroll', this.reportData.directPayroll);
        html += this.renderDataRow('Direct Expenses', this.reportData.directExpenses);
        html += this.renderDataRow('Materials', this.reportData.materials);
        html += this.renderDataRow('Subcontractor Charges', this.reportData.subcontractorCharges);
        html += this.renderDataRow('Transportation & Fuel', this.reportData.transportationFuel);
        html += this.renderDataRow('Freight and Custom Duty', this.reportData.freightCustomDuty);
        html += this.renderDataRow('Prov for Employees End of Service Benefits-Direct', this.reportData.provisionEmployees);
        html += this.renderDataRow('Dep on Property and Equipment (Projects)-Direct', this.reportData.depreciation);
        html += this.renderDataRow('Other Direct Expenses', this.reportData.otherDirectExpenses);
        html += this.renderDataRow('Rental Labors', this.reportData.rentalLabors);
        html += this.renderDataRow('Work in Progress', this.reportData.workInProgress);
        html += this.renderTotalRow('TOTAL DIRECT COST', this.reportData.totalDirectCost, 'pl-total-row');
        
        // GROSS PROFIT
        html += this.renderTotalRow('TOTAL GROSS PROFIT', this.reportData.grossProfit, 'pl-gross-profit-row');
        // GOP% Row
        html += this.renderPercentageRow('GOP%', this.calculateGOPPercentage());
        
        // GENERAL & ADMINISTRATIVE EXPENSES Section
        html += this.renderCategoryHeader('GENERAL & ADMINISTRATIVE EXPENSES');
        html += this.renderDataRow('Indirect Payroll', this.reportData.indirectPayroll);
        html += this.renderDataRow('Other Administration Expenses', this.reportData.otherAdminExpenses);
        html += this.renderDataRow('Employees Allowances (Leave Salaries,Accom,EOS,Car,Bonus)', this.reportData.employeesAllowances);
        html += this.renderDataRow('Motor Vehicle Petrol and Maintenance', this.reportData.motorVehicle);
        html += this.renderDataRow('Professional and Government Fees', this.reportData.professionalFees);
        html += this.renderDataRow('Licenses and Visa Fees', this.reportData.licensesVisaFees);
        html += this.renderDataRow('Rent', this.reportData.rent);
        html += this.renderDataRow('Marketing (Clients Inquiries and Tender Costs)', this.reportData.marketing);
        html += this.renderDataRow('Insurance', this.reportData.insurance);
        html += this.renderDataRow('Travel & Entertainment (Tickets)', this.reportData.travelEntertainment);
        html += this.renderDataRow('Telephone', this.reportData.telephone);
        html += this.renderDataRow('Depreciation of Property and Equipment-Indirect', this.reportData.depreciationIndirect);
        html += this.renderDataRow('Printing & Stationery', this.reportData.printingStationery);
        html += this.renderDataRow('Electricity & Water', this.reportData.electricityWater);
        html += this.renderDataRow('Office Supplies', this.reportData.officeSupplies);
        html += this.renderDataRow('Depreciation of Right to use asset', this.reportData.depreciationRightToUse);
        html += this.renderDataRow('Repairs & Maintenance & Uniforms & IT', this.reportData.repairsMaintenance);
        html += this.renderDataRow('Prov for Employees End of Service Benefits-Indirect', this.reportData.provisionEmployeesIndirect);
        html += this.renderDataRow('Other General & Admin Expenses', this.reportData.otherGeneralAdmin);
        html += this.renderDataRow('Impairment of Trade Receivables', this.reportData.impairmentTradeReceivables);
        html += this.renderDataRow('Impairment of Retention Receivables', this.reportData.impairmentRetentionReceivables);
        html += this.renderDataRow('Loss on Liquidated Bank Guarantees', this.reportData.lossLiquidatedBankGuarantees);
        html += this.renderTotalRow('TOTAL GENERAL & ADMINISTRATIVE EXPENSES', this.reportData.totalGeneralAdmin, 'pl-total-row');
        
        // OPERATING PROFIT
        html += this.renderTotalRow('TOTAL OPERATING PROFIT', this.reportData.totalOperatingProfit, 'pl-operating-profit-row');
        
        // OTHER INCOME/EXPENSES
        html += this.renderCategoryHeader('OTHER INCOME/EXPENSES');
        html += this.renderDataRow('Borrowings Costs', this.reportData.borrowingsCosts);
        html += this.renderDataRow('Other Income', this.reportData.otherIncome);
        
        // NET PROFIT
        html += this.renderTotalRow('TOTAL NET PROFIT FOR THE YEAR', this.reportData.netProfit, 'pl-net-profit-row');
        // NOP% Row
        html += this.renderPercentageRow('NOP%', this.calculateNOPPercentage());
        
        // HEADCOUNT Section
        html += this.renderCategoryHeader('HEADCOUNT');
        html += this.renderHeadcountRow('Direct Headcount', this.reportData.directHeadcount);
        html += this.renderHeadcountRow('Indirect Headcount', this.reportData.indirectHeadcount);
        html += this.renderHeadcountTotalRow('Total Headcount', this.reportData.totalHeadcount);
        
        tbody.innerHTML = html;
        document.getElementById('plContent').style.display = 'block';
        
        console.log('P&L report rendered successfully');
        
    } catch (renderError) {
        console.error('Error rendering report:', renderError);
        this.showError();
        this.updateStatusBar(`Render Error: ${renderError.message}`);
    }
}
    
    renderCategoryHeader(title) {
    return `
        <tr class="pl-category-header">
            <td><strong>${title}</strong></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
    `;
}


    
    renderDataRow(description, amounts) {
    const actualAmount = amounts?.actual ?? 0;
    const cumulativeAmount = amounts?.cumulative ?? 0;
    const previousAmount = amounts?.previous ?? 0;
    const budgetAmount = amounts?.budget ?? 0; // NEW: Add budget amount
    
    return `
        <tr class="pl-data-row">
            <td>${description}</td>
            <td class="amount-cell">${this.formatAmount(actualAmount)}</td>
            <td class="amount-cell">${this.formatAmount(cumulativeAmount)}</td>
            <td class="amount-cell">${this.formatAmount(previousAmount)}</td>
            <td class="amount-cell">${this.formatAmount(budgetAmount)}</td>
            <td class="amount-cell">-</td>
            <td class="amount-cell">-</td>
        </tr>
    `;
}
    
    renderTotalRow(title, totals, cssClass) {
    const actualAmount = totals?.actual ?? 0;
    const cumulativeAmount = totals?.cumulative ?? 0;
    const previousAmount = totals?.previous ?? 0;
    const budgetAmount = totals?.budget ?? 0; // NEW: Add budget amount
    
    return `
        <tr class="${cssClass}">
            <td><strong>${title}</strong></td>
            <td class="amount-cell"><strong>${this.formatAmount(actualAmount)}</strong></td>
            <td class="amount-cell"><strong>${this.formatAmount(cumulativeAmount)}</strong></td>
            <td class="amount-cell"><strong>${this.formatAmount(previousAmount)}</strong></td>
            <td class="amount-cell"><strong>${this.formatAmount(budgetAmount)}</strong></td>
            <td class="amount-cell"><strong>-</strong></td>
            <td class="amount-cell"><strong>-</strong></td>
        </tr>
    `;
}
    
    renderSpacerRow() {
    return `
        <tr class="pl-spacer-row">
            <td colspan="7" style="height: 8px; border: none;"></td>
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
        console.log('📁 Exporting P&L report...');
        
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
        csvContent += `\nREVENUE\n`;
        csvContent += `,"REVENUE",${this.reportData.revenue.actual},${this.reportData.revenue.cumulative},${this.reportData.revenue.previous},-,-,-\n\n`;
        
        csvContent += `DIRECT COST\n`;
        csvContent += `,"Direct Payroll",${this.reportData.directPayroll.actual},${this.reportData.directPayroll.cumulative},${this.reportData.directPayroll.previous},-,-,-\n`;
        csvContent += `,"Direct Expenses",${this.reportData.directExpenses.actual},${this.reportData.directExpenses.cumulative},${this.reportData.directExpenses.previous},-,-,-\n`;
        csvContent += `,"Materials",${this.reportData.materials.actual},${this.reportData.materials.cumulative},${this.reportData.materials.previous},-,-,-\n`;
        csvContent += `,"Subcontractor Charges",${this.reportData.subcontractorCharges.actual},${this.reportData.subcontractorCharges.cumulative},${this.reportData.subcontractorCharges.previous},-,-,-\n`;
        csvContent += `,"Transportation & Fuel",${this.reportData.transportationFuel.actual},${this.reportData.transportationFuel.cumulative},${this.reportData.transportationFuel.previous},-,-,-\n`;
        csvContent += `,"Freight and Custom Duty",${this.reportData.freightCustomDuty.actual},${this.reportData.freightCustomDuty.cumulative},${this.reportData.freightCustomDuty.previous},-,-,-\n`;
        csvContent += `,"Prov for Employees End of Service Benefits-Direct",${this.reportData.provisionEmployees.actual},${this.reportData.provisionEmployees.cumulative},${this.reportData.provisionEmployees.previous},-,-,-\n`;
        csvContent += `,"Dep on Property and Equipment (Projects)-Direct",${this.reportData.depreciation.actual},${this.reportData.depreciation.cumulative},${this.reportData.depreciation.previous},-,-,-\n`;
        csvContent += `,"Other Direct Expenses",${this.reportData.otherDirectExpenses.actual},${this.reportData.otherDirectExpenses.cumulative},${this.reportData.otherDirectExpenses.previous},-,-,-\n`;
        csvContent += `,"Rental Labors",${this.reportData.rentalLabors.actual},${this.reportData.rentalLabors.cumulative},${this.reportData.rentalLabors.previous},-,-,-\n`;
        csvContent += `,"Work in Progress",${this.reportData.workInProgress.actual},${this.reportData.workInProgress.cumulative},${this.reportData.workInProgress.previous},-,-,-\n`;
        csvContent += `,"TOTAL DIRECT COST",${this.reportData.totalDirectCost.actual},${this.reportData.totalDirectCost.cumulative},${this.reportData.totalDirectCost.previous},-,-,-\n\n`;
        
        // Add gross profit
        csvContent += `,"TOTAL GROSS PROFIT",${this.reportData.grossProfit.actual},${this.reportData.grossProfit.cumulative},${this.reportData.grossProfit.previous},-,-,-\n\n`;
        
        csvContent += `EXPENSES\n`;
        csvContent += `,"Total Expenses",${this.reportData.totalExpenses.actual},${this.reportData.totalExpenses.cumulative},${this.reportData.totalExpenses.previous},-,-,-\n`;
        csvContent += `,"TOTAL EXPENSES",${this.reportData.totalExpenses.actual},${this.reportData.totalExpenses.cumulative},${this.reportData.totalExpenses.previous},-,-,-\n\n`;
        
        // Add net profit
        csvContent += `,"TOTAL NET PROFIT",${this.reportData.netProfit.actual},${this.reportData.netProfit.cumulative},${this.reportData.netProfit.previous},-,-,-\n`;
        
        // Download file
        const filename = `PL_Report_${monthName}_${year}.csv`;
        this.downloadCSV(csvContent, filename);
        
        console.log('✅ P&L report exported successfully');
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