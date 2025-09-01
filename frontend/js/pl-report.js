// =====================================================
// UPDATED P&L REPORT WITH CORRECTED VARIANCE FORMULAS
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
        console.log('📊 Initializing P&L Report Manager with Corrected Variance Logic...');
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
            if (window.scrollY > 300) {
                scrollIndicator.classList.add('show');
            } else {
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
            
            console.log(`📊 Loading P&L Report with Corrected Variance for ${year}-${month}...`);
            this.updateStatusBar('Loading financial data...');
            
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
            this.updateStatusBar(`Report generated successfully for ${this.getMonthName(month)} ${year}`);
            
            this.retryCount = 0;
            console.log('✅ P&L Report loaded successfully');
            
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
    // Revenue: (ACTUAL - BUDGET) / BUDGET × 100
    // Others: (BUDGET - ACTUAL) / BUDGET × 100
    // =====================================================
    
    calculateVarianceForRevenue(actual, budget) {
        // REVENUE FORMULA: (ACTUAL - BUDGET) / BUDGET × 100
        if (!budget || budget === 0) {
            if (!actual || actual === 0) {
                return 0; // Both zero = no variance
            }
            return actual > 0 ? 999 : -999; // Infinite variance indicator
        }
        
        const actualNum = parseFloat(actual) || 0;
        const budgetNum = parseFloat(budget) || 0;
        
        // Revenue variance: (Actual - Budget) / Budget × 100
        const varianceDecimal = ((actualNum - budgetNum) / budgetNum) * 100;
        
        // Proper rounding
        return Math.round(varianceDecimal);
    }
    
    calculateVarianceForOthers(actual, budget) {
        // ALL OTHER CATEGORIES: (BUDGET - ACTUAL) / BUDGET × 100
        if (!budget || budget === 0) {
            if (!actual || actual === 0) {
                return 0; // Both zero = no variance
            }
            return actual > 0 ? -999 : 999; // Infinite variance indicator (reversed for costs)
        }
        
        const actualNum = parseFloat(actual) || 0;
        const budgetNum = parseFloat(budget) || 0;
        
        // Cost/Expense variance: (Budget - Actual) / Budget × 100
        const varianceDecimal = ((budgetNum - actualNum) / budgetNum) * 100;
        
        // Proper rounding
        return Math.round(varianceDecimal);
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
        const display = variancePercent > 0 ? `+${variancePercent}%` : `${variancePercent}%`;
        
        return `<span class="${cssClass}">${display}</span>`;
    }
    
    renderCompleteReport() {
        console.log('📊 Rendering Complete P&L Report with Corrected Variance Logic...');
        
        const tbody = document.getElementById('plTableBody');
        let html = '';
        
        try {
            // REVENUE Section (uses revenue variance formula)
            html += this.renderCategoryHeader('REVENUE');
            html += this.renderRevenueRow('REVENUE', this.reportData.revenue);
            
            // DIRECT COST Section (uses cost variance formula)
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
            
            console.log('✅ Complete P&L Report with Corrected Variance rendered successfully');
            
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
    // SEPARATE RENDER FUNCTIONS FOR DIFFERENT VARIANCE LOGIC
    // =====================================================
    
    // Revenue row - uses revenue variance formula
    renderRevenueRow(description, amounts) {
        const actualAmount = amounts?.actual ?? 0;
        const cumulativeAmount = amounts?.cumulative ?? 0;
        const previousAmount = amounts?.previous ?? 0;
        const budgetAmount = amounts?.budget ?? 0;
        
        // Calculate variance using REVENUE formula: (Actual - Budget) / Budget × 100
        const variancePercent = this.calculateVarianceForRevenue(actualAmount, budgetAmount);
        
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
    
    // Income row - uses revenue variance formula (for Other Income)
    renderIncomeRow(description, amounts) {
        const actualAmount = amounts?.actual ?? 0;
        const cumulativeAmount = amounts?.cumulative ?? 0;
        const previousAmount = amounts?.previous ?? 0;
        const budgetAmount = amounts?.budget ?? 0;
        
        // Calculate variance using REVENUE formula: (Actual - Budget) / Budget × 100
        const variancePercent = this.calculateVarianceForRevenue(actualAmount, budgetAmount);
        
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
    
    // Cost/Expense row - uses cost variance formula
    renderDataRow(description, amounts) {
        const actualAmount = amounts?.actual ?? 0;
        const cumulativeAmount = amounts?.cumulative ?? 0;
        const previousAmount = amounts?.previous ?? 0;
        const budgetAmount = amounts?.budget ?? 0;
        
        // Calculate variance using COST formula: (Budget - Actual) / Budget × 100
        const variancePercent = this.calculateVarianceForOthers(actualAmount, budgetAmount);
        
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
        
        // Determine which formula to use based on title
        let variancePercent;
        if (title.includes('GROSS PROFIT') || title.includes('OPERATING PROFIT') || title.includes('NET PROFIT')) {
            // Profit rows use revenue formula
            variancePercent = this.calculateVarianceForRevenue(actualAmount, budgetAmount);
        } else {
            // Cost total rows use cost formula
            variancePercent = this.calculateVarianceForOthers(actualAmount, budgetAmount);
        }
        
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
        
        // Headcount uses cost formula (lower is better)
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
        
        // Total headcount uses cost formula (lower is better)
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
    
    async exportToCSV() {
        console.log('📁 Exporting P&L Report with Corrected Variance to CSV...');
        
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
            
            this.showToast('Report with Corrected Variance exported successfully!', 'success');
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
        document.getElementById('plStatusInfo').textContent = message;
        document.getElementById('plTimestamp').textContent = new Date().toLocaleString();
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
// TESTING THE CORRECTED VARIANCE CALCULATION
// Console examples to verify proper formulas
// =====================================================

function testCorrectedVarianceCalculation() {
    console.log('🧪 Testing CORRECTED Variance Calculation...');
    
    const plManager = new PLReportManager();
    
    console.log('\n📈 REVENUE FORMULA: (Actual - Budget) / Budget × 100');
    console.log('Revenue Test Cases:');
    
    const revenueTests = [
        { actual: 1200, budget: 1000, expected: 20 },   // +20% (actual higher = good)
        { actual: 800, budget: 1000, expected: -20 },   // -20% (actual lower = bad)
        { actual: 1166, budget: 1000, expected: 17 },   // +16.6% → +17%
        { actual: 834, budget: 1000, expected: -17 }    // -16.6% → -17%
    ];
    
    revenueTests.forEach((test, index) => {
        const result = plManager.calculateVarianceForRevenue(test.actual, test.budget);
        const passed = result === test.expected;
        console.log(`Revenue Test ${index + 1}: Actual=${test.actual}, Budget=${test.budget} → ${result}% (Expected: ${test.expected}%) ${passed ? '✅' : '❌'}`);
    });
    
    console.log('\n💰 COST FORMULA: (Budget - Actual) / Budget × 100');
    console.log('Cost Test Cases:');
    
    const costTests = [
        { actual: 800, budget: 1000, expected: 20 },    // +20% (actual lower = good)
        { actual: 1200, budget: 1000, expected: -20 },  // -20% (actual higher = bad)
        { actual: 834, budget: 1000, expected: 17 },    // +16.6% → +17%
        { actual: 1166, budget: 1000, expected: -17 }   // -16.6% → -17%
    ];
    
    costTests.forEach((test, index) => {
        const result = plManager.calculateVarianceForOthers(test.actual, test.budget);
        const passed = result === test.expected;
        console.log(`Cost Test ${index + 1}: Actual=${test.actual}, Budget=${test.budget} → ${result}% (Expected: ${test.expected}%) ${passed ? '✅' : '❌'}`);
    });
    
    console.log('\n✅ Variance logic: Positive = Good, Negative = Bad (for both Revenue and Costs)');
}

// Global functions for HTML onclick events
let plManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 DOM loaded, initializing P&L Report with CORRECTED Variance Logic...');
    plManager = new PLReportManager();
    
    // Run corrected variance calculation tests
    testCorrectedVarianceCalculation();
    
    // Auto-generate report after 1 second
    setTimeout(() => {
        loadPLReport();
    }, 1000);
});

function loadPLReport() {
    if (plManager) {
        plManager.loadPLReport();
    } else {
        console.error('❌ PLManager not initialized');
    }
}

function exportPLReport() {
    if (plManager) {
        plManager.exportToCSV();
    } else {
        console.error('❌ PLManager not initialized');
    }
}

function printReport() {
    if (plManager) {
        plManager.printReport();
    } else {
        console.error('❌ PLManager not initialized');
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

console.log('✅ P&L Report with CORRECTED Variance Calculation loaded successfully');