// =====================================================
// COMPLETE P&L REPORT WITH CORRECTED VARIANCE FORMULAS
// File: frontend/js/pl-report.js
// Revenue: (ACTUAL - BUDGET) / BUDGET × 100
// All Others: (BUDGET - ACTUAL) / BUDGET × 100
// =====================================================

class PLReportManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth() + 1;
        this.reportData = {};
        this.isLoading = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.init();
    }
    
    init() {
        console.log('📊 Initializing P&L Report Manager with CORRECTED Variance Logic...');
        console.log('📈 Revenue Formula: (ACTUAL - BUDGET) / BUDGET × 100');
        console.log('💰 Cost Formula: (BUDGET - ACTUAL) / BUDGET × 100');
        this.bindEvents();
        this.setupScrollIndicator();
        this.setCurrentDate();
    }
    
    bindEvents() {
        document.getElementById('plYear').addEventListener('change', () => {
            this.updateReportHeader();
        });
        
        document.getElementById('plMonth').addEventListener('change', () => {
            this.updateReportHeader();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.loadPLReport();
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
        document.getElementById('plYear').value = now.getFullYear();
        document.getElementById('plMonth').value = now.getMonth() + 1;
        this.updateReportHeader();
    }
    
    updateReportHeader() {
        const year = document.getElementById('plYear').value;
        const month = document.getElementById('plMonth').value;
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const monthName = monthNames[month - 1];
        const monthShort = monthName.substring(0, 3).toUpperCase();
        
        document.getElementById('plReportPeriod').textContent = 
            `For the Month Ended ${monthName} ${year}`;
        document.getElementById('plActualHeader').textContent = `${monthShort} ${year}`;
        document.getElementById('plAccumHeader').textContent = `JAN-${monthShort} ${year}`;
    }
    
    async loadPLReport() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        this.hideError();
        this.disableButtons(true);
        
        try {
            const year = parseInt(document.getElementById('plYear').value);
            const month = parseInt(document.getElementById('plMonth').value);
            
            console.log(`📊 Loading P&L Report with CORRECTED Variance for ${year}-${month}...`);
            this.updateStatusBar('Loading financial data with corrected variance formulas...');
            
            const response = await fetch(`/api/reports/pl-complete/${year}/${month}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch P&L data');
            }
            
            if (!result.data) {
                throw new Error('No data returned from server');
            }
            
            this.reportData = this.validateAndProcessData(result.data);
            this.renderCompleteReport();
            this.updateStatusBar(`Report generated successfully for ${this.getMonthName(month)} ${year} with corrected variance`);
            
            this.retryCount = 0;
            console.log('✅ P&L Report with CORRECTED Variance loaded successfully');
            
            // Test variance calculations after loading
            this.testVarianceCalculations();
            
        } catch (error) {
            console.error('❌ Error loading P&L report:', error);
            this.handleError(error);
        } finally {
            this.isLoading = false;
            this.showLoading(false);
            this.disableButtons(false);
        }
    }
    
    validateAndProcessData(data) {
        const defaultAmounts = { actual: 0, cumulative: 0, previous: 0, budget: 0 };
        
        const processedData = {
            // Revenue
            revenue: data.revenue || defaultAmounts,
            
            // Direct Costs
            directPayroll: data.directPayroll || defaultAmounts,
            directExpenses: data.directExpenses || defaultAmounts,
            materials: data.materials || defaultAmounts,
            subcontractorCharges: data.subcontractorCharges || defaultAmounts,
            transportationFuel: data.transportationFuel || defaultAmounts,
            freightCustomDuty: data.freightCustomDuty || defaultAmounts,
            provisionEmployees: data.provisionEmployees || defaultAmounts,
            depreciation: data.depreciation || defaultAmounts,
            otherDirectExpenses: data.otherDirectExpenses || defaultAmounts,
            rentalLabors: data.rentalLabors || defaultAmounts,
            workInProgress: data.workInProgress || defaultAmounts,
            totalDirectCost: data.totalDirectCost || defaultAmounts,
            grossProfit: data.grossProfit || defaultAmounts,
            
            // General & Administrative Expenses
            indirectPayroll: data.indirectPayroll || defaultAmounts,
            otherAdminExpenses: data.otherAdminExpenses || defaultAmounts,
            employeesAllowances: data.employeesAllowances || defaultAmounts,
            motorVehicle: data.motorVehicle || defaultAmounts,
            professionalFees: data.professionalFees || defaultAmounts,
            licensesVisaFees: data.licensesVisaFees || defaultAmounts,
            rent: data.rent || defaultAmounts,
            marketing: data.marketing || defaultAmounts,
            insurance: data.insurance || defaultAmounts,
            travelEntertainment: data.travelEntertainment || defaultAmounts,
            telephone: data.telephone || defaultAmounts,
            depreciationIndirect: data.depreciationIndirect || defaultAmounts,
            printingStationery: data.printingStationery || defaultAmounts,
            electricityWater: data.electricityWater || defaultAmounts,
            officeSupplies: data.officeSupplies || defaultAmounts,
            depreciationRightToUse: data.depreciationRightToUse || defaultAmounts,
            repairsMaintenance: data.repairsMaintenance || defaultAmounts,
            provisionEmployeesIndirect: data.provisionEmployeesIndirect || defaultAmounts,
            otherGeneralAdmin: data.otherGeneralAdmin || defaultAmounts,
            impairmentTradeReceivables: data.impairmentTradeReceivables || defaultAmounts,
            impairmentRetentionReceivables: data.impairmentRetentionReceivables || defaultAmounts,
            lossLiquidatedBankGuarantees: data.lossLiquidatedBankGuarantees || defaultAmounts,
            totalGeneralAdmin: data.totalGeneralAdmin || defaultAmounts,
            totalOperatingProfit: data.totalOperatingProfit || defaultAmounts,
            
            // Other Income/Expenses
            borrowingsCosts: data.borrowingsCosts || defaultAmounts,
            otherIncome: data.otherIncome || defaultAmounts,
            netProfit: data.netProfit || defaultAmounts,
            
            // Headcount
            directHeadcount: data.directHeadcount || defaultAmounts,
            indirectHeadcount: data.indirectHeadcount || defaultAmounts,
            totalHeadcount: data.totalHeadcount || defaultAmounts
        };
        
        return processedData;
    }
    
    // =====================================================
    // CORRECTED VARIANCE CALCULATION FUNCTIONS
    // =====================================================
    
    calculateVarianceForRevenue(actual, budget) {
    console.log(`🔢 REVENUE Variance: Actual=${actual}, Budget=${budget}`);
    
    // Handle budget being negative (shown in parentheses)
    const budgetNum = parseFloat(budget) || 0;
    const actualBudget = Math.abs(budgetNum); // Use absolute value for calculations
    
    if (!actualBudget || actualBudget === 0) {
        if (!actual || actual === 0) {
            return 0; // Both zero = no variance
        }
        return actual > 0 ? 999 : -999; // Infinite variance
    }
    
    const actualNum = parseFloat(actual) || 0;
    
    // REVENUE FORMULA: (ACTUAL - BUDGET) / BUDGET × 100
    // NOTE: Already multiply by 100 here, don't multiply again in display
    const variancePercent = ((actualNum - actualBudget) / actualBudget) * 100;
    const rounded = Math.round(variancePercent);
    
    console.log(`📈 REVENUE CALC: (${actualNum} - ${actualBudget}) / ${actualBudget} × 100 = ${rounded}%`);
    return rounded;
}
    
    calculateVarianceForOthers(actual, budget) {
    console.log(`🔢 COST/EXPENSE Variance: Actual=${actual}, Budget=${budget}`);
    
    // Handle budget being negative (shown in parentheses)  
    const budgetNum = parseFloat(budget) || 0;
    const actualBudget = Math.abs(budgetNum); // Use absolute value for calculations
    
    if (!actualBudget || actualBudget === 0) {
        if (!actual || actual === 0) {
            return 0; // Both zero = no variance
        }
        return actual > 0 ? -999 : 999; // Infinite variance (reversed)
    }
    
    const actualNum = parseFloat(actual) || 0;
    
    // COST/EXPENSE FORMULA: (BUDGET - ACTUAL) / BUDGET × 100
    // NOTE: Already multiply by 100 here, don't multiply again in display
    const variancePercent = ((actualBudget - actualNum) / actualBudget) * 100;
    const rounded = Math.round(variancePercent);
    
    console.log(`💰 COST CALC: (${actualBudget} - ${actualNum}) / ${actualBudget} × 100 = ${rounded}%`);
    return rounded;
}
    
    // Format variance percentage for display
    formatVariancePercentage(variancePercent) {
    if (variancePercent === 999) {
        return '<span class="variance-infinite-positive">+∞%</span>';
    }
    if (variancePercent === -999) {
        return '<span class="variance-infinite-negative">-∞%</span>';
    }
    if (variancePercent === 0) {
        return '<span class="variance-zero">0%</span>';
    }
    
    const cssClass = variancePercent > 0 ? 'variance-positive' : 'variance-negative';
    // Don't multiply by 100 - it's already a percentage
    const display = variancePercent > 0 ? `+${variancePercent}%` : `${variancePercent}%`;
    
    return `<span class="${cssClass}">${display}</span>`;
}
    
    renderCompleteReport() {
        console.log('📊 Rendering Complete P&L Report with CORRECTED Variance Logic...');
        
        const tbody = document.getElementById('plTableBody');
        let html = '';
        
        try {
            // REVENUE Section (uses revenue variance formula)
            html += this.renderCategoryHeader('REVENUE');
            html += this.renderRevenueRow('REVENUE', this.reportData.revenue);
            
            // DIRECT COST Section (uses cost variance formula)
            html += this.renderCategoryHeader('DIRECT COSTS');
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
            
            // GROSS PROFIT + GOP%
            html += this.renderTotalRow('TOTAL GROSS PROFIT', this.reportData.grossProfit, 'pl-gross-profit-row');
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
            html += this.renderIncomeRow('Other Income', this.reportData.otherIncome); // Use revenue formula for income
            
            // NET PROFIT + NOP%
            html += this.renderTotalRow('TOTAL NET PROFIT FOR THE YEAR', this.reportData.netProfit, 'pl-net-profit-row');
            html += this.renderPercentageRow('NOP%', this.calculateNOPPercentage());
            
            // HEADCOUNT Section
            html += this.renderCategoryHeader('HEADCOUNT');
            html += this.renderHeadcountRow('Direct Headcount', this.reportData.directHeadcount);
            html += this.renderHeadcountRow('Indirect Headcount', this.reportData.indirectHeadcount);
            html += this.renderHeadcountTotalRow('Total Headcount', this.reportData.totalHeadcount);
            
            tbody.innerHTML = html;
            document.getElementById('plContent').style.display = 'block';
            
            console.log('✅ Complete P&L Report with CORRECTED Variance rendered successfully');
            
        } catch (renderError) {
            console.error('❌ Error rendering report:', renderError);
            this.handleError(renderError);
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
    
    // =====================================================
    // RENDER FUNCTIONS WITH CORRECT VARIANCE LOGIC
    // =====================================================
    
    // Revenue row - uses REVENUE variance formula
    renderRevenueRow(description, amounts) {
        const actualAmount = amounts?.actual ?? 0;
        const cumulativeAmount = amounts?.cumulative ?? 0;
        const previousAmount = amounts?.previous ?? 0;
        const budgetAmount = amounts?.budget ?? 0;
        
        // Use REVENUE formula: (Actual - Budget) / Budget × 100
        const variancePercent = this.calculateVarianceForRevenue(actualAmount, budgetAmount);
        
        console.log(`📊 REVENUE ROW: ${description} - Actual: ${actualAmount}, Budget: ${budgetAmount}, Variance: ${variancePercent}%`);
        
        return `
            <tr class="pl-data-row">
                <td>${description}</td>
                <td class="amount-cell">${this.formatAmount(actualAmount)}</td>
                <td class="amount-cell">${this.formatAmount(cumulativeAmount)}</td>
                <td class="amount-cell">${this.formatAmount(previousAmount)}</td>
                <td class="amount-cell">${this.formatAmount(budgetAmount)}</td>
                <td class="amount-cell">${this.formatVariancePercentage(variancePercent)}</td>
                <td class="amount-cell">-</td>
            </tr>
        `;
    }
    
    // Income row - uses REVENUE variance formula (for Other Income)
    renderIncomeRow(description, amounts) {
        const actualAmount = amounts?.actual ?? 0;
        const cumulativeAmount = amounts?.cumulative ?? 0;
        const previousAmount = amounts?.previous ?? 0;
        const budgetAmount = amounts?.budget ?? 0;
        
        // Use REVENUE formula for income: (Actual - Budget) / Budget × 100
        const variancePercent = this.calculateVarianceForRevenue(actualAmount, budgetAmount);
        
        console.log(`📊 INCOME ROW: ${description} - Actual: ${actualAmount}, Budget: ${budgetAmount}, Variance: ${variancePercent}%`);
        
        return `
            <tr class="pl-data-row">
                <td>${description}</td>
                <td class="amount-cell">${this.formatAmount(actualAmount)}</td>
                <td class="amount-cell">${this.formatAmount(cumulativeAmount)}</td>
                <td class="amount-cell">${this.formatAmount(previousAmount)}</td>
                <td class="amount-cell">${this.formatAmount(budgetAmount)}</td>
                <td class="amount-cell">${this.formatVariancePercentage(variancePercent)}</td>
                <td class="amount-cell">-</td>
            </tr>
        `;
    }
    
    // Cost/Expense row - uses COST variance formula
    renderDataRow(description, amounts) {
        const actualAmount = amounts?.actual ?? 0;
        const cumulativeAmount = amounts?.cumulative ?? 0;
        const previousAmount = amounts?.previous ?? 0;
        const budgetAmount = amounts?.budget ?? 0;
        
        // Use COST formula: (Budget - Actual) / Budget × 100
        const variancePercent = this.calculateVarianceForOthers(actualAmount, budgetAmount);
        
        console.log(`📊 COST ROW: ${description} - Actual: ${actualAmount}, Budget: ${budgetAmount}, Variance: ${variancePercent}%`);
        
        return `
            <tr class="pl-data-row">
                <td>${description}</td>
                <td class="amount-cell">${this.formatAmount(actualAmount)}</td>
                <td class="amount-cell">${this.formatAmount(cumulativeAmount)}</td>
                <td class="amount-cell">${this.formatAmount(previousAmount)}</td>
                <td class="amount-cell">${this.formatAmount(budgetAmount)}</td>
                <td class="amount-cell">${this.formatVariancePercentage(variancePercent)}</td>
                <td class="amount-cell">-</td>
            </tr>
        `;
    }
    
    // Total row - determine formula based on row type
    renderTotalRow(title, totals, cssClass) {
        const actualAmount = totals?.actual ?? 0;
        const cumulativeAmount = totals?.cumulative ?? 0;
        const previousAmount = totals?.previous ?? 0;
        const budgetAmount = totals?.budget ?? 0;
        
        let variancePercent;
        let formulaUsed = '';
        
        // Determine which formula based on title
        const titleUpper = title.toUpperCase();
        
        if (titleUpper.includes('REVENUE')) {
            // REVENUE uses revenue formula
            variancePercent = this.calculateVarianceForRevenue(actualAmount, budgetAmount);
            formulaUsed = 'REVENUE';
        } else if (titleUpper.includes('GROSS PROFIT') || titleUpper.includes('OPERATING PROFIT') || titleUpper.includes('NET PROFIT') || titleUpper.includes('PROFIT')) {
            // PROFIT rows use revenue formula (higher is better)
            variancePercent = this.calculateVarianceForRevenue(actualAmount, budgetAmount);
            formulaUsed = 'PROFIT (Revenue Formula)';
        } else {
            // All COST/EXPENSE totals use cost formula
            variancePercent = this.calculateVarianceForOthers(actualAmount, budgetAmount);
            formulaUsed = 'COST';
        }
        
        console.log(`📊 TOTAL ROW: ${title} - Using ${formulaUsed} formula - Actual: ${actualAmount}, Budget: ${budgetAmount}, Variance: ${variancePercent}%`);
        
        return `
            <tr class="${cssClass}">
                <td><strong>${title}</strong></td>
                <td class="amount-cell"><strong>${this.formatAmount(actualAmount)}</strong></td>
                <td class="amount-cell"><strong>${this.formatAmount(cumulativeAmount)}</strong></td>
                <td class="amount-cell"><strong>${this.formatAmount(previousAmount)}</strong></td>
                <td class="amount-cell"><strong>${this.formatAmount(budgetAmount)}</strong></td>
                <td class="amount-cell"><strong>${this.formatVariancePercentage(variancePercent)}</strong></td>
                <td class="amount-cell"><strong>-</strong></td>
            </tr>
        `;
    }
    
    renderPercentageRow(title, percentages) {
        const actualPercentage = percentages?.actual ?? 0;
        const cumulativePercentage = percentages?.cumulative ?? 0;
        const previousPercentage = percentages?.previous ?? 0;
        
        return `
            <tr class="pl-percentage-row">
                <td><strong>${title}</strong></td>
                <td class="amount-cell"><strong>${this.formatPercentage(actualPercentage)}</strong></td>
                <td class="amount-cell"><strong>${this.formatPercentage(cumulativePercentage)}</strong></td>
                <td class="amount-cell"><strong>${this.formatPercentage(previousPercentage)}</strong></td>
                <td class="amount-cell"><strong>-</strong></td>
                <td class="amount-cell"><strong>-</strong></td>
                <td class="amount-cell"><strong>-</strong></td>
            </tr>
        `;
    }
    
    renderHeadcountRow(description, counts) {
        const actualCount = counts?.actual ?? 0;
        const cumulativeCount = counts?.cumulative ?? 0;
        const previousCount = counts?.previous ?? 0;
        const budgetCount = counts?.budget ?? 0;
        
        // Headcount uses cost formula (lower actual is better)
        const variancePercent = this.calculateVarianceForOthers(actualCount, budgetCount);
        
        return `
            <tr class="pl-headcount-row">
                <td>${description}</td>
                <td class="amount-cell">${actualCount}</td>
                <td class="amount-cell">${cumulativeCount}</td>
                <td class="amount-cell">${previousCount}</td>
                <td class="amount-cell">${budgetCount}</td>
                <td class="amount-cell">${this.formatVariancePercentage(variancePercent)}</td>
                <td class="amount-cell">-</td>
            </tr>
        `;
    }
    
    renderHeadcountTotalRow(title, counts) {
        const actualCount = counts?.actual ?? 0;
        const cumulativeCount = counts?.cumulative ?? 0;
        const previousCount = counts?.previous ?? 0;
        const budgetCount = counts?.budget ?? 0;
        
        // Total headcount uses cost formula (lower actual is better)
        const variancePercent = this.calculateVarianceForOthers(actualCount, budgetCount);
        
        return `
            <tr class="pl-headcount-header">
                <td><strong>${title}</strong></td>
                <td class="amount-cell"><strong>${actualCount}</strong></td>
                <td class="amount-cell"><strong>${cumulativeCount}</strong></td>
                <td class="amount-cell"><strong>${previousCount}</strong></td>
                <td class="amount-cell"><strong>${budgetCount}</strong></td>
                <td class="amount-cell"><strong>${this.formatVariancePercentage(variancePercent)}</strong></td>
                <td class="amount-cell"><strong>-</strong></td>
            </tr>
        `;
    }
    
    calculateGOPPercentage() {
        const grossProfitActual = this.reportData.grossProfit?.actual ?? 0;
        const grossProfitCumulative = this.reportData.grossProfit?.cumulative ?? 0;
        const grossProfitPrevious = this.reportData.grossProfit?.previous ?? 0;
        
        const revenueActual = this.reportData.revenue?.actual ?? 0;
        const revenueCumulative = this.reportData.revenue?.cumulative ?? 0;
        const revenuePrevious = this.reportData.revenue?.previous ?? 0;
        
        return {
            actual: revenueActual !== 0 ? Math.round((grossProfitActual / revenueActual) * 100) : 0,
            cumulative: revenueCumulative !== 0 ? Math.round((grossProfitCumulative / revenueCumulative) * 100) : 0,
            previous: revenuePrevious !== 0 ? Math.round((grossProfitPrevious / revenuePrevious) * 100) : 0
        };
    }
    
    calculateNOPPercentage() {
        const netProfitActual = this.reportData.netProfit?.actual ?? 0;
        const netProfitCumulative = this.reportData.netProfit?.cumulative ?? 0;
        const netProfitPrevious = this.reportData.netProfit?.previous ?? 0;
        
        const revenueActual = this.reportData.revenue?.actual ?? 0;
        const revenueCumulative = this.reportData.revenue?.cumulative ?? 0;
        const revenuePrevious = this.reportData.revenue?.previous ?? 0;
        
        return {
            actual: revenueActual !== 0 ? Math.round((netProfitActual / revenueActual) * 100) : 0,
            cumulative: revenueCumulative !== 0 ? Math.round((netProfitCumulative / revenueCumulative) * 100) : 0,
            previous: revenuePrevious !== 0 ? Math.round((netProfitPrevious / revenuePrevious) * 100) : 0
        };
    }
    
    formatAmount(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount === 0) {
            return '<span class="amount-zero">-</span>';
        }
        
        const formatted = Math.abs(numAmount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        const cssClass = numAmount > 0 ? 'amount-positive' : 'amount-negative';
        const display = numAmount < 0 ? `(${formatted})` : formatted;
        
        return `<span class="${cssClass}">${display}</span>`;
    }
    
    formatPercentage(percentage) {
        const numPercentage = parseFloat(percentage);
        if (isNaN(numPercentage)) {
            return '<span class="amount-zero">0%</span>';
        }
        
        const cssClass = numPercentage > 0 ? 'amount-positive' : 'amount-negative';
        const display = numPercentage < 0 ? `(${Math.abs(numPercentage)}%)` : `${numPercentage}%`;
        
        return `<span class="${cssClass}">${display}</span>`;
    }
    
    // =====================================================
    // TESTING FUNCTION FOR VARIANCE CALCULATIONS
    // =====================================================
    
    testVarianceCalculations() {
        console.log('\n🧪 TESTING CORRECTED VARIANCE CALCULATIONS');
        console.log('===============================================');
        
        console.log('\n📈 REVENUE TESTS (Formula: (Actual - Budget) / Budget × 100)');
        console.log('Expected: Higher Actual = Positive Variance (Good)');
        
        const revenueTests = [
            { actual: 1200, budget: 1000, expected: 20 },   // Better than budget
            { actual: 800, budget: 1000, expected: -20 },   // Worse than budget
            { actual: 1000, budget: 1000, expected: 0 },    // Exactly on budget
            { actual: 1150, budget: 1000, expected: 15 }    // 15% better
        ];
        
        revenueTests.forEach((test, index) => {
            const result = this.calculateVarianceForRevenue(test.actual, test.budget);
            const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
            console.log(`Revenue Test ${index + 1}: Actual=${test.actual}, Budget=${test.budget} → ${result}% (Expected: ${test.expected}%) ${status}`);
        });
        
        console.log('\n💰 COST/EXPENSE TESTS (Formula: (Budget - Actual) / Budget × 100)');
        console.log('Expected: Lower Actual = Positive Variance (Good)');
        
        const costTests = [
            { actual: 800, budget: 1000, expected: 20 },    // Spent less = good
            { actual: 1200, budget: 1000, expected: -20 },  // Spent more = bad
            { actual: 1000, budget: 1000, expected: 0 },    // Exactly on budget
            { actual: 850, budget: 1000, expected: 15 }     // 15% under budget
        ];
        
        costTests.forEach((test, index) => {
            const result = this.calculateVarianceForOthers(test.actual, test.budget);
            const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
            console.log(`Cost Test ${index + 1}: Actual=${test.actual}, Budget=${test.budget} → ${result}% (Expected: ${test.expected}%) ${status}`);
        });
        
        console.log('\n✅ VARIANCE LOGIC SUMMARY:');
        console.log('Revenue: (Actual - Budget) / Budget × 100');
        console.log('Costs: (Budget - Actual) / Budget × 100');
        console.log('Both formulas: Positive = Good Performance, Negative = Poor Performance');
        console.log('===============================================\n');
    }
    
    async exportToCSV() {
        console.log('📁 Exporting P&L Report with CORRECTED Variance to CSV...');
        
        if (!this.reportData || Object.keys(this.reportData).length === 0) {
            this.showToast('No report data to export. Please generate a report first.', 'warning');
            return;
        }
        
        try {
            const year = document.getElementById('plYear').value;
            const month = document.getElementById('plMonth').value;
            const monthName = this.getMonthName(parseInt(month));
            
            let csvContent = `PROFIT & LOSS STATEMENT WITH CORRECTED VARIANCE ANALYSIS\n`;
            csvContent += `For the Month Ended ${monthName} ${year}\n\n`;
            csvContent += `Revenue Formula: (Actual - Budget) / Budget × 100\n`;
            csvContent += `Cost Formula: (Budget - Actual) / Budget × 100\n\n`;
            csvContent += `Particulars,Actual,Accum System,Last Report MIS,Budget,Variance %,Last Year\n`;
            
            // Add revenue with revenue formula
            const revenueVariance = this.calculateVarianceForRevenue(this.reportData.revenue.actual, this.reportData.revenue.budget);
            csvContent += `\nREVENUE\n`;
            csvContent += `REVENUE,${this.reportData.revenue.actual},${this.reportData.revenue.cumulative},${this.reportData.revenue.previous},${this.reportData.revenue.budget || 0},${revenueVariance}%,-\n`;
            
            // Add costs with cost formula
            csvContent += `\nDIRECT COSTS\n`;
            Object.entries({
                'Direct Payroll': this.reportData.directPayroll,
                'Materials': this.reportData.materials,
                'Subcontractor Charges': this.reportData.subcontractorCharges,
                'Transportation & Fuel': this.reportData.transportationFuel,
                'Freight and Custom Duty': this.reportData.freightCustomDuty,
                'Other Direct Expenses': this.reportData.otherDirectExpenses
            }).forEach(([name, data]) => {
                const variance = this.calculateVarianceForOthers(data.actual, data.budget);
                csvContent += `${name},${data.actual},${data.cumulative},${data.previous},${data.budget || 0},${variance}%,-\n`;
            });
            
            // Add totals with appropriate formulas
            const totalDirectVariance = this.calculateVarianceForOthers(this.reportData.totalDirectCost.actual, this.reportData.totalDirectCost.budget);
            csvContent += `TOTAL DIRECT COST,${this.reportData.totalDirectCost.actual},${this.reportData.totalDirectCost.cumulative},${this.reportData.totalDirectCost.previous},${this.reportData.totalDirectCost.budget || 0},${totalDirectVariance}%,-\n`;
            
            const grossProfitVariance = this.calculateVarianceForRevenue(this.reportData.grossProfit.actual, this.reportData.grossProfit.budget);
            csvContent += `TOTAL GROSS PROFIT,${this.reportData.grossProfit.actual},${this.reportData.grossProfit.cumulative},${this.reportData.grossProfit.previous},${this.reportData.grossProfit.budget || 0},${grossProfitVariance}%,-\n`;
            
            const netProfitVariance = this.calculateVarianceForRevenue(this.reportData.netProfit.actual, this.reportData.netProfit.budget);
            csvContent += `TOTAL NET PROFIT,${this.reportData.netProfit.actual},${this.reportData.netProfit.cumulative},${this.reportData.netProfit.previous},${this.reportData.netProfit.budget || 0},${netProfitVariance}%,-\n`;
            
            const filename = `PL_Report_Corrected_Variance_${monthName}_${year}.csv`;
            this.downloadFile(csvContent, filename, 'text/csv');
            
            this.showToast('Report with CORRECTED Variance exported successfully!', 'success');
            console.log('✅ CSV export with corrected variance completed');
            
        } catch (error) {
            console.error('❌ Export error:', error);
            this.showToast('Export failed. Please try again.', 'error');
        }
    }
    
    printReport() {
        console.log('🖨️ Printing P&L Report...');
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
                this.loadPLReport();
            }, 2000);
        } else {
            this.showError();
            this.updateStatusBar(`Failed to load report after ${this.maxRetries} attempts: ${error.message}`);
            this.showToast('Failed to load P&L report. Please check your connection and try again.', 'error');
        }
    }
    
    showLoading(show) {
        const loadingElement = document.getElementById('plLoading');
        const contentElement = document.getElementById('plContent');
        
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
        if (contentElement) {
            contentElement.style.display = show ? 'none' : 'block';
        }
    }
    
    showError() {
        const errorElement = document.getElementById('plError');
        const contentElement = document.getElementById('plContent');
        
        if (errorElement) {
            errorElement.style.display = 'flex';
        }
        if (contentElement) {
            contentElement.style.display = 'none';
        }
    }
    
    hideError() {
        const errorElement = document.getElementById('plError');
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
        const statusInfo = document.getElementById('plStatusInfo');
        const timestamp = document.getElementById('plTimestamp');
        
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

let plManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 DOM loaded, initializing P&L Report with CORRECTED Variance Logic...');
    
    // Initialize the P&L Manager
    plManager = new PLReportManager();
    
    // Make it globally accessible for debugging
    window.plManager = plManager;
    
    console.log('✅ P&L Manager initialized with corrected variance formulas');
    
    // Auto-generate report after 1.5 seconds
    setTimeout(() => {
        console.log('🚀 Auto-loading P&L Report...');
        loadPLReport();
    }, 1500);
});

function loadPLReport() {
    if (plManager) {
        console.log('📊 Loading P&L Report via global function...');
        plManager.loadPLReport();
    } else {
        console.error('❌ PLManager not initialized');
        alert('P&L Manager not initialized. Please refresh the page.');
    }
}

function exportPLReport() {
    if (plManager) {
        console.log('📁 Exporting P&L Report via global function...');
        plManager.exportToCSV();
    } else {
        console.error('❌ PLManager not initialized');
        alert('P&L Manager not initialized. Please refresh the page.');
    }
}

function printReport() {
    if (plManager) {
        console.log('🖨️ Printing P&L Report via global function...');
        plManager.printReport();
    } else {
        console.error('❌ PLManager not initialized');
        alert('P&L Manager not initialized. Please refresh the page.');
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// =====================================================
// MANUAL TESTING FUNCTION FOR CONSOLE
// =====================================================

function testVarianceManually() {
    console.log('\n🔬 MANUAL VARIANCE TESTING');
    console.log('============================');
    
    if (!window.plManager) {
        console.error('❌ plManager not available. Load the report first.');
        return;
    }
    
    console.log('\n📈 Testing REVENUE Formula: (Actual - Budget) / Budget × 100');
    
    // Test revenue scenarios
    const revenueScenarios = [
        { name: 'Revenue Higher than Budget', actual: 120000, budget: 100000 },
        { name: 'Revenue Lower than Budget', actual: 80000, budget: 100000 },
        { name: 'Revenue Exactly on Budget', actual: 100000, budget: 100000 },
        { name: 'Revenue with Zero Budget', actual: 50000, budget: 0 }
    ];
    
    revenueScenarios.forEach(scenario => {
        const variance = window.plManager.calculateVarianceForRevenue(scenario.actual, scenario.budget);
        console.log(`${scenario.name}: Actual=${scenario.actual}, Budget=${scenario.budget} → ${variance}%`);
    });
    
    console.log('\n💰 Testing COST Formula: (Budget - Actual) / Budget × 100');
    
    // Test cost scenarios
    const costScenarios = [
        { name: 'Cost Lower than Budget (Good)', actual: 80000, budget: 100000 },
        { name: 'Cost Higher than Budget (Bad)', actual: 120000, budget: 100000 },
        { name: 'Cost Exactly on Budget', actual: 100000, budget: 100000 },
        { name: 'Cost with Zero Budget', actual: 50000, budget: 0 }
    ];
    
    costScenarios.forEach(scenario => {
        const variance = window.plManager.calculateVarianceForOthers(scenario.actual, scenario.budget);
        console.log(`${scenario.name}: Actual=${scenario.actual}, Budget=${scenario.budget} → ${variance}%`);
    });
    
    console.log('\n✅ Manual testing complete. Check results above.');
}

// =====================================================
// INITIALIZATION MESSAGE
// =====================================================

console.log('🚀 COMPLETE P&L REPORT WITH CORRECTED VARIANCE LOADED');
console.log('📈 Revenue Formula: (ACTUAL - BUDGET) / BUDGET × 100');
console.log('💰 Cost Formula: (BUDGET - ACTUAL) / BUDGET × 100');
console.log('✅ Both formulas result in: Positive = Good, Negative = Bad');
console.log('🔧 Available functions: loadPLReport(), exportPLReport(), printReport(), testVarianceManually()');

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PLReportManager;
}